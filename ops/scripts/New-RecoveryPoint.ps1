<#
.SYNOPSIS
    Creates a recovery point before any change to NouvellesDuPays.
    -Target OnPrem (default since 2026-11-02): on-prem production over SSH to dr-rke2.
    -Target OKE: the OKE cluster through a Bastion tunnel (the original behaviour, below).
    Snapshots git state, package versions, the live Postgres database
    (via kubectl exec pg_dump inside the cluster), and current k8s
    deployment state (image tags, replica counts). Run this before ANY
    medium or high-risk change.

.DESCRIPTION
    Requires a live Bastion tunnel to the OKE cluster for the Postgres dump
    and k8s state snapshot -- if kubectl isn't reachable, those two steps
    are SKIPPED (not failed) and clearly flagged in the output/metadata, but
    the recovery point is still created with whatever it could capture.

.EXAMPLE
    .\New-RecoveryPoint.ps1 -Description "Before adding a 6th pilot country" -Reason "New feature" -ExpectedImpact "Low"
#>
param(
    [Parameter(Mandatory)][string]$Description,
    [string]$Reason       = "",
    [string[]]$FilesAffected = @(),
    [string]$ExpectedImpact  = "Low",
    [string]$RollbackInstructions = "Run Invoke-Rollback.ps1 and select this point.",
    # OnPrem (default since 2026-11-02, production) or OKE (secondary).
    [ValidateSet('OnPrem', 'OKE')][string]$Target = 'OnPrem'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$env:KUBECONFIG = "C:\Users\Administrator\.kube\config"

$REPO_DIR = "C:\inetpub\wwwroot\nouvellesdupays"
$OPS_DIR  = "$REPO_DIR\ops"
$HISTORY  = "$OPS_DIR\BACKUP_HISTORY.md"
$K8S_NS   = "nouvellesdupays"

$stamp  = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$slug   = ($Description -replace '[^a-zA-Z0-9]', '-').ToLower() -replace '-+', '-'
$slug   = $slug.Substring(0, [Math]::Min($slug.Length, 40)).TrimEnd('-')
$ptDir  = "$OPS_DIR\recovery-points\$stamp`_$slug"

Write-Host "`n=== Creating NouvellesDuPays Recovery Point ===" -ForegroundColor Cyan
Write-Host "Directory: $ptDir"
New-Item -ItemType Directory -Force $ptDir | Out-Null

# ── Git state ────────────────────────────────────────────────────────────────
Write-Host "  [1/5] Capturing git state..."
$repoBranch = git -C $REPO_DIR rev-parse --abbrev-ref HEAD 2>&1
$repoCommit = git -C $REPO_DIR rev-parse HEAD 2>&1
$repoStatus = git -C $REPO_DIR status --short 2>&1
$repoLog    = git -C $REPO_DIR log --oneline -5 2>&1

@"
=== nouvellesdupays ===
Branch : $repoBranch
Commit : $repoCommit
Status :
$($repoStatus | Out-String)

Recent commits:
$($repoLog | Out-String)
"@ | Set-Content "$ptDir\git-state.txt" -Encoding UTF8

# ── Package versions ─────────────────────────────────────────────────────────
Write-Host "  [2/5] Capturing package versions..."
$rootPkg = Get-Content "$REPO_DIR\package.json" | ConvertFrom-Json
@{
    root = @{ name = $rootPkg.name }
    capturedAt = (Get-Date -Format "o")
} | ConvertTo-Json -Depth 10 | Set-Content "$ptDir\package-versions.json" -Encoding UTF8

# ── ON-PREM production (default since 2026-11-02) ────────────────────────────
# Readers are served by the on-prem RKE2 (dr-rke2 192.168.1.51, ns nouvellesdupays) with its own Postgres
# (dr-postgres 192.168.1.52) -- see MAINTENANCE_LOG 2026-11-02. State and the dump are taken over SSH;
# the dump is made and pg_restore-checked inside a throwaway pod and kept on dr-rke2 (onprem-dump.sh).
$k8sOk = $false
$dbOk = $false
$backupObjectName = $null
$BACKUP_BUCKET = $null
if ($Target -eq 'OnPrem') {
    $sshArgs = @('-i', 'C:\Users\Administrator\.ssh\dr-rke2', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30')
    $kRemote = 'sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays'
    Write-Host "  [3/5] Capturing ON-PREM k8s state (dr-rke2 over SSH)..."
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
    for ($try = 1; $try -le 3 -and -not $k8sOk; $try++) {
        if ($try -gt 1) { Write-Host "        (dr-rke2 unreachable - retry $($try-1)/2 in 15s)" -ForegroundColor Yellow; Start-Sleep 15 }
        $state = & ssh @sshArgs ubuntu@192.168.1.51 "$kRemote get deployment nouvellesdupays-api nouvellesdupays-web -o yaml && echo '---' && $kRemote get cronjob -o yaml" 2>$null
        if ($LASTEXITCODE -eq 0 -and "$state" -match 'nouvellesdupays-worker') {
            $state | Set-Content "$ptDir\k8s-onprem-state.yaml" -Encoding UTF8
            $k8sOk = $true
            Write-Host "        On-prem k8s state captured."
        }
    }
    Write-Host "  [4/5] Full pg_dump of the ON-PREM production DB (kept on dr-rke2)..."
    & scp @sshArgs -q "$PSScriptRoot\onprem-dump.sh" "ubuntu@192.168.1.51:onprem-dump.sh" 2>$null
    $dumpOut = & ssh @sshArgs ubuntu@192.168.1.51 "bash ~/onprem-dump.sh '$slug'" 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'Unhandled Error|Websocket' }
    $ErrorActionPreference = $prevEAP
    $okLine = $dumpOut | Where-Object { $_ -match '^dump OK: (\S+)' } | Select-Object -Last 1
    if ($okLine -and $okLine -match '^dump OK: (\S+)') {
        $dbOk = $true
        $BACKUP_BUCKET = 'dr-rke2:~/ndp-backups'
        $backupObjectName = Split-Path $Matches[1] -Leaf
        Write-Host "        $okLine"
    } else {
        Write-Host "        SKIPPED — on-prem dump failed:" -ForegroundColor Red
        $dumpOut | Select-Object -Last 5 | ForEach-Object { Write-Host "          $_" -ForegroundColor Red }
    }
} else {

    # ── K8s deployment state snapshot ────────────────────────────────────────────
    Write-Host "  [3/5] Capturing k8s deployment state (needs Bastion tunnel)..."
    $k8sOk = $false
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"   # native kubectl/oci stderr noise must not become a terminating error here
    # Up to 3 tries, 15 s apart: a single Bastion blip used to turn the whole point PARTIAL (2026-10-16 x2, 2026-10-17).
    for ($try = 1; $try -le 3 -and -not $k8sOk; $try++) {
        if ($try -gt 1) { Write-Host "        (kubectl unreachable - retry $($try-1)/2 in 15s)" -ForegroundColor Yellow; Start-Sleep 15 }
        try {
            $deployApi = kubectl get deployment nouvellesdupays-api -n $K8S_NS -o yaml --request-timeout=40s 2>$null; $e1 = $LASTEXITCODE
            $deployWeb = kubectl get deployment nouvellesdupays-web -n $K8S_NS -o yaml --request-timeout=40s 2>$null; $e2 = $LASTEXITCODE
            $cronWorker = kubectl get cronjob nouvellesdupays-worker -n $K8S_NS -o yaml --request-timeout=40s 2>$null; $e3 = $LASTEXITCODE
            if ($e1 -eq 0 -and $e2 -eq 0 -and $e3 -eq 0) {
                $deployApi  | Set-Content "$ptDir\k8s-deployment-api.yaml" -Encoding UTF8
                $deployWeb  | Set-Content "$ptDir\k8s-deployment-web.yaml" -Encoding UTF8
                $cronWorker | Set-Content "$ptDir\k8s-cronjob-worker.yaml" -Encoding UTF8
                $k8sOk = $true
                Write-Host "        K8s state captured."
            }
        } catch { }
    }
    $ErrorActionPreference = $prevEAP
    if (-not $k8sOk) { Write-Host "        SKIPPED — kubectl unreachable after 3 tries (is the Bastion tunnel up?)" -ForegroundColor Yellow }

    # ── Postgres dump (on-demand off-cluster backup job, NOT streamed through
    #    the Bastion tunnel) ──────────────────────────────────────────────────
    # Original approach was `kubectl exec postgres-0 -- pg_dump | Set-Content`,
    # streaming the whole dump through the SSH port-forwarding tunnel to this
    # machine. Found (2026-10-02, this migration's own recovery point) to be
    # fundamentally unreliable once the dump passed a few hundred MB: both
    # `kubectl exec` and `kubectl cp` intermittently dropped mid-stream
    # ("websocket: close 1006 (abnormal closure)" / hangs that outlasted
    # --request-timeout entirely) -- a transport limit on the Bastion session
    # itself, not something a client-side timeout flag can fix. The dump
    # ultimately only succeeded via ~20 minutes of manual chunk-splitting and
    # per-chunk retries -- not something this script can reasonably automate.
    #
    # Fix: reuse the project's own existing daily backup mechanism
    # (apps/backup/backup.sh, 11-db-backup-cronjob.yaml) instead of a bespoke
    # dump path. That script runs INSIDE the cluster (pg_dump | gzip | oci os
    # object put, instance_principal auth) and uploads straight to OCI Object
    # Storage -- no Bastion tunnel involved in moving the actual dump bytes at
    # all. This script just triggers one on-demand run of that same CronJob and
    # confirms the resulting object landed, which only needs a handful of small
    # kubectl/oci API calls, not a sustained bulk transfer.
    Write-Host "  [4/5] Triggering on-demand off-cluster Postgres backup..."
    $BACKUP_BUCKET = "nouvellesdupays-db-backups"
    $OCI_NAMESPACE = "lr14abpkfrxj"
    $dbOk = $false
    $backupObjectName = $null
    $ociAvailable = $null -ne (Get-Command oci -ErrorAction SilentlyContinue)
    if ($k8sOk -and $ociAvailable) {
        $prevEAP2 = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        try {
            # Job names must be DNS-1123 (lowercase, digits, '-'); $stamp contains '_', so build our own.
            $jobName = "ndp-db-backup-manual-" + (Get-Date -Format "yyyyMMdd-HHmmss")
            $jobStart = Get-Date
            # Up to 3 tries. Before each retry, check whether the job already exists: if the create
            # reached the cluster but the reply was lost, retrying blindly would start a second backup.
            $created = $false
            for ($try = 1; $try -le 3 -and -not $created; $try++) {
                if ($try -gt 1) {
                    Start-Sleep -Seconds 15
                    kubectl get job $jobName -n $K8S_NS --request-timeout=30s 2>$null | Out-Null
                    if ($LASTEXITCODE -eq 0) { $created = $true; Write-Host "        (job $jobName exists - the create went through)"; break }
                    Write-Host "        (could not create backup job - retry $($try-1)/2)" -ForegroundColor Yellow
                }
                $createOut = kubectl create job -n $K8S_NS --from=cronjob/nouvellesdupays-db-backup $jobName --request-timeout=60s 2>&1 |
                    ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security|SUPPRESS_LABEL_WARNING' }
                $created = $LASTEXITCODE -eq 0
            }

            # Poll against a wall-clock deadline: each kubectl call itself takes seconds over the tunnel.
            # A failed poll (tunnel blip) is just retried on the next round.
            $jobDone = $false
            $jobFailed = $false
            $deadline = (Get-Date).AddMinutes(6)
            while ($created -and (Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 10
                $status = kubectl get job $jobName -n $K8S_NS -o jsonpath='{.status.succeeded}{" "}{.status.failed}' --request-timeout=30s 2>$null
                if ($status -match '^1') { $jobDone = $true; break }
                if ($status -match '\d$') { $jobFailed = $true; break }
            }

            if (-not $created) {
                Write-Host "        SKIPPED — could not create backup job $jobName after 3 tries:" -ForegroundColor Red
                $createOut | ForEach-Object { Write-Host "          $_" -ForegroundColor Red }
            } elseif ($jobFailed) {
                Write-Host "        SKIPPED — backup job $jobName failed (kubectl logs job/$jobName -n $K8S_NS)" -ForegroundColor Red
            } else {
                # Check the bucket even when polling never saw the job finish: the upload goes
                # through OCI Object Storage, not the tunnel, so a lost tunnel doesn't mean a
                # lost backup (2026-10-16 release 4 run 1: the job had completed, the point was
                # marked PARTIAL anyway). The backup script names its object by the UTC time
                # pg_dump runs, so accept only an object created after this job started.
                if (-not $jobDone) { Write-Host "        (job status unknown after 6 min - checking the bucket directly for up to 4 min)" -ForegroundColor Yellow }
                $bucketDeadline = (Get-Date).AddMinutes($(if ($jobDone) { 0 } else { 4 }))
                $latest = $null
                do {
                    $listJson = oci os object list --namespace $OCI_NAMESPACE --bucket-name $BACKUP_BUCKET --all 2>$null
                    if ($listJson) {
                        $latest = ($listJson | ConvertFrom-Json).data |
                            Where-Object { [datetime]$_.'time-created' -gt $jobStart -and $_.size -gt 1MB } |
                            Sort-Object -Property 'time-created' -Descending | Select-Object -First 1
                    }
                    if ($latest -or (Get-Date) -ge $bucketDeadline) { break }
                    Start-Sleep -Seconds 30
                } while ($true)
                if ($latest) {
                    $dbOk = $true
                    $backupObjectName = $latest.name
                    $ageMinutes = ((Get-Date) - [datetime]$latest.'time-created').TotalMinutes
                    Write-Host "        DB backup: $($latest.name) ($([Math]::Round($latest.size/1KB,1)) KB, uploaded $([Math]::Round($ageMinutes,1)) min ago)"
                } else {
                    Write-Host "        SKIPPED — no bucket object over 1 MB created since the job started ($(Get-Date $jobStart -Format HH:mm:ss))" -ForegroundColor Red
                }
            }
            # Only delete a job known to be finished: deleting one still running would kill the backup.
            if ($jobDone -or $dbOk) { kubectl delete job $jobName -n $K8S_NS --request-timeout=30s 2>$null | Out-Null }
            $ErrorActionPreference = $prevEAP2
        } catch {
            $ErrorActionPreference = $prevEAP2
            Write-Host "        SKIPPED — on-demand backup failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } elseif (-not $ociAvailable) {
        Write-Host "        SKIPPED — oci CLI not on PATH" -ForegroundColor Yellow
    } else {
        Write-Host "        SKIPPED — no k8s access this run" -ForegroundColor Yellow
    }
}  # end -Target OKE

# ── Metadata ─────────────────────────────────────────────────────────────────
Write-Host "  [5/5] Writing metadata..."
$meta = [ordered]@{
    id                   = "$stamp`_$slug"
    timestamp            = (Get-Date -Format "o")
    description          = $Description
    reason               = $Reason
    filesAffected        = $FilesAffected
    expectedImpact       = $ExpectedImpact
    rollbackInstructions = $RollbackInstructions
    repoCommit           = $repoCommit.ToString().Trim()
    repoBranch           = $repoBranch.ToString().Trim()
    k8sStateCaptured     = $k8sOk
    target               = $Target
    dbDumpCaptured       = $dbOk
    dbBackupBucket       = if ($dbOk) { $BACKUP_BUCKET } else { $null }
    dbBackupObjectName   = $backupObjectName
}
$meta | ConvertTo-Json -Depth 5 | Set-Content "$ptDir\metadata.json" -Encoding UTF8

# ── Append to BACKUP_HISTORY.md ──────────────────────────────────────────────
$histEntry = @"

## $(Get-Date -Format "yyyy-MM-dd HH:mm:ss") — $Description

- **ID**: $($meta.id)
- **Reason**: $Reason
- **Repo commit**: $($repoCommit.ToString().Trim().Substring(0,8)) ($repoBranch)
- **Target**: $Target
- **K8s state captured**: $k8sOk
- **DB backup**: $(if ($dbOk) { "$BACKUP_BUCKET/$backupObjectName" } else { "SKIPPED (no cluster/oci access this run)" })
- **Impact**: $ExpectedImpact
- **Files affected**: $($FilesAffected -join ', ')
- **Rollback**: ``.\Invoke-Rollback.ps1 -PointId "$($meta.id)"``

"@
Add-Content $HISTORY $histEntry -Encoding UTF8

if ($k8sOk -and $dbOk) {
    Write-Host "`n✅ Recovery point created (full): $($meta.id)" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Recovery point created (PARTIAL — code state only, no DB/k8s snapshot): $($meta.id)" -ForegroundColor Yellow
    Write-Host "   $(if ($Target -eq 'OnPrem') { 'Check SSH to dr-rke2 (192.168.1.51)' } else { 'Open a Bastion tunnel' }) and re-run for a complete recovery point before a HIGH risk change." -ForegroundColor Yellow
}
if ($Target -eq 'OnPrem' -and $dbOk) {
    # Invoke-Rollback.ps1 only knows OKE. On-prem: code via git, data from the dump on dr-rke2.
    Write-Host "   To restore the on-prem DB: pod with nouvellesdupays-secrets + hostPath /home/ubuntu/ndp-backups, then pg_restore --clean --if-exists -d `"`$DATABASE_URL`" /backups/$backupObjectName (HIGH - needs a window)"
} else {
    Write-Host "   To restore: .\Invoke-Rollback.ps1 -PointId `"$($meta.id)`""
}

# Exit code for release runners ($LASTEXITCODE): 0 = full point, 2 = PARTIAL. It used to be
# whatever the last kubectl call returned, so a runner could carry on after a PARTIAL point.
if ($k8sOk -and $dbOk) { exit 0 } else { exit 2 }
