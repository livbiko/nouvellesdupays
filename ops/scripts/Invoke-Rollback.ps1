<#
.SYNOPSIS
    Restores NouvellesDuPays to a previous recovery point (git state + Postgres).

.DESCRIPTION
    Restores the git repo to the recorded commit and/or restores the Postgres
    database from the recovery point's dump (via kubectl exec, no port-forward
    needed). Does NOT rebuild/redeploy container images -- see CHANGE_MGMT.md's
    "code rollback is not a live-reload" note. Needs a live Bastion tunnel for
    the DB restore.

.EXAMPLE
    .\Invoke-Rollback.ps1                            # Interactive -- lists all points
    .\Invoke-Rollback.ps1 -PointId "2026-07-26_..."  # Direct rollback
    .\Invoke-Rollback.ps1 -Latest                    # Restore the most recent point
#>
param(
    [string]$PointId = "",
    [switch]$Latest,
    [switch]$DbOnly,
    [switch]$CodeOnly,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$env:KUBECONFIG = "C:\Users\Administrator\.kube\config"

$REPO_DIR = "C:\inetpub\wwwroot\nouvellesdupays"
$OPS_DIR  = "$REPO_DIR\ops"
$PTS_DIR  = "$OPS_DIR\recovery-points"
$K8S_NS   = "nouvellesdupays"

# ── List available points ────────────────────────────────────────────────────
$points = Get-ChildItem $PTS_DIR -Directory | Sort-Object Name -Descending
if ($points.Count -eq 0) { Write-Error "No recovery points found in $PTS_DIR"; exit 1 }

if ($Latest) { $PointId = $points[0].Name }

if (-not $PointId) {
    Write-Host "`nAvailable recovery points:" -ForegroundColor Cyan
    $i = 0
    foreach ($pt in $points) {
        $meta = Get-Content "$($pt.FullName)\metadata.json" | ConvertFrom-Json
        Write-Host "  [$i] $($meta.id)"
        Write-Host "      $($meta.description)"
        Write-Host "      Repo: $($meta.repoCommit.Substring(0,8)) | DB backup: $($meta.dbDumpCaptured) | $($meta.timestamp)"
        $i++
    }
    $choice = Read-Host "`nEnter number to restore (or q to quit)"
    if ($choice -eq 'q') { exit 0 }
    $PointId = $points[[int]$choice].Name
}

$ptDir = "$PTS_DIR\$PointId"
if (-not (Test-Path $ptDir)) { Write-Error "Recovery point not found: $PointId"; exit 1 }

$meta = Get-Content "$ptDir\metadata.json" | ConvertFrom-Json

Write-Host "`n=== ROLLBACK PLAN ===" -ForegroundColor Yellow
Write-Host "  Point   : $($meta.id)"
Write-Host "  Created : $($meta.timestamp)"
Write-Host "  Reason  : $($meta.description)"
Write-Host "  Repo    : $($meta.repoCommit.Substring(0,8)) ($($meta.repoBranch))"
Write-Host "  DB backup : $(if ($meta.dbDumpCaptured) { "$($meta.dbBackupBucket)/$($meta.dbBackupObjectName)" } else { "NOT AVAILABLE in this point" })"
Write-Host ""
Write-Host "  This will:" -ForegroundColor Red
if (-not $DbOnly)   { Write-Host "    - Hard-reset the nouvellesdupays repo to commit $($meta.repoCommit.Substring(0,8))" }
if (-not $CodeOnly) {
    if ($meta.dbDumpCaptured) {
        Write-Host "    - Drop and restore the Postgres 'nouvellesdupays' database (live, in-cluster)"
    } else {
        Write-Host "    - SKIP database restore (this recovery point has no DB dump)"
    }
}
Write-Host "    - Code rollback does NOT rebuild/redeploy images -- see CHANGE_MGMT.md" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type 'ROLLBACK' to confirm"
    if ($confirm -ne 'ROLLBACK') { Write-Host "Aborted."; exit 0 }
}

Write-Host "`n=== Executing Rollback ===" -ForegroundColor Cyan

# ── Restore code ─────────────────────────────────────────────────────────────
if (-not $DbOnly) {
    Write-Host "  [1/2] Restoring repo to $($meta.repoCommit.Substring(0,8))..."
    git -C $REPO_DIR fetch --quiet 2>&1 | Out-Null
    git -C $REPO_DIR checkout $meta.repoBranch 2>&1 | Out-Null
    git -C $REPO_DIR reset --hard $meta.repoCommit 2>&1 | Out-Null
    Write-Host "        Repo restored. Remember: rebuild+redeploy images to make this live (CHANGE_MGMT.md)."
}

# ── Restore database ──────────────────────────────────────────────────────────
# Restores server-side, inside the cluster -- the dump is pulled directly
# from OCI Object Storage into the restore pod (instance_principal auth,
# same as apps/backup/backup.sh) and piped straight into psql there. kubectl
# is only used to create/poll/delete this one Job, never to stream the dump
# itself through the Bastion tunnel -- see New-RecoveryPoint.ps1's comment
# on why that path (kubectl exec/cp of a large dump) is unreliable.
if (-not $CodeOnly) {
    if ($meta.dbDumpCaptured -and $meta.dbBackupObjectName) {
        Write-Host "  [2/2] Restoring Postgres from $($meta.dbBackupBucket)/$($meta.dbBackupObjectName) (server-side, in-cluster)..."
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        $restoreJobName = "nouvellesdupays-db-restore-manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        try {
            $restoreManifest = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: $restoreJobName
  namespace: $K8S_NS
spec:
  backoffLimit: 0
  activeDeadlineSeconds: 900
  template:
    spec:
      imagePullSecrets:
        - name: ocir-pull-secret
      restartPolicy: Never
      containers:
        - name: restore
          image: lhr.ocir.io/lr14abpkfrxj/nouvellesdupays-backup:latest
          command: ["sh", "-c"]
          args:
            - |
              set -eu
              oci --auth instance_principal os object get --namespace lr14abpkfrxj --bucket-name $($meta.dbBackupBucket) --name '$($meta.dbBackupObjectName)' --file /tmp/restore.sql.gz
              gunzip -c /tmp/restore.sql.gz | psql "`$DATABASE_URL"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: nouvellesdupays-secrets
                  key: DATABASE_URL
"@
            $restoreManifest | kubectl apply -f - 2>$null | Out-Null

            $jobDone = $false
            $jobSucceeded = $false
            for ($i = 0; $i -lt 90; $i++) {
                Start-Sleep -Seconds 5
                $status = kubectl get job $restoreJobName -n $K8S_NS -o jsonpath='{.status.succeeded}{" "}{.status.failed}' --request-timeout=30s 2>$null
                if ($status -match '^1') { $jobDone = $true; $jobSucceeded = $true; break }
                if ($status -match '1$') { $jobDone = $true; $jobSucceeded = $false; break }
            }
            $ErrorActionPreference = $prevEAP

            if ($jobSucceeded) {
                Write-Host "        Database restored."
            } else {
                $logs = kubectl logs "job/$restoreJobName" -n $K8S_NS --request-timeout=30s 2>$null
                Write-Host "        ⚠️  Database restore failed or timed out. Logs:" -ForegroundColor Red
                Write-Host "        $logs" -ForegroundColor Red
            }
            kubectl delete job $restoreJobName -n $K8S_NS --request-timeout=30s 2>$null | Out-Null
        } catch {
            $ErrorActionPreference = $prevEAP
            Write-Host "        ⚠️  Database restore failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  [2/2] No DB backup reference in this recovery point — skipping database restore."
    }
}

# ── Quick health check ────────────────────────────────────────────────────────
Write-Host "`nChecking public site health..."
try {
    $r = Invoke-RestMethod "https://nouvellesdupays.com/api/countries" -TimeoutSec 15
    Write-Host "✅ Rollback complete — public API responding ($($r.Count) countries)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Public API check failed after rollback: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   If the code rollback needs a rebuild+redeploy, that step hasn't happened yet." -ForegroundColor Yellow
}

Write-Host "   Restored from: $($meta.id)"
