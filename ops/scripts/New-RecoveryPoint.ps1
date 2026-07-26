<#
.SYNOPSIS
    Creates a recovery point before any change to NouvellesDuPays.
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
    [string]$RollbackInstructions = "Run Invoke-Rollback.ps1 and select this point."
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

# ── K8s deployment state snapshot ────────────────────────────────────────────
Write-Host "  [3/5] Capturing k8s deployment state (needs Bastion tunnel)..."
$k8sOk = $false
try {
    $deployApi = kubectl get deployment nouvellesdupays-api -n $K8S_NS -o yaml --request-timeout=40s 2>&1
    $deployWeb = kubectl get deployment nouvellesdupays-web -n $K8S_NS -o yaml --request-timeout=40s 2>&1
    $cronWorker = kubectl get cronjob nouvellesdupays-worker -n $K8S_NS -o yaml --request-timeout=40s 2>&1
    if ($LASTEXITCODE -eq 0) {
        $deployApi  | Set-Content "$ptDir\k8s-deployment-api.yaml" -Encoding UTF8
        $deployWeb  | Set-Content "$ptDir\k8s-deployment-web.yaml" -Encoding UTF8
        $cronWorker | Set-Content "$ptDir\k8s-cronjob-worker.yaml" -Encoding UTF8
        $k8sOk = $true
        Write-Host "        K8s state captured."
    } else {
        Write-Host "        SKIPPED — kubectl unreachable (is the Bastion tunnel up?)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "        SKIPPED — kubectl unreachable: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ── Postgres dump (via kubectl exec, no port-forward needed) ────────────────
Write-Host "  [4/5] Dumping Postgres (via kubectl exec)..."
$dbDumpFile = "$ptDir\postgres-dump.sql"
$dbOk = $false
if ($k8sOk) {
    try {
        kubectl exec postgres-0 -n $K8S_NS --request-timeout=60s -- pg_dump -U nouvellesdupays nouvellesdupays 2>$null |
            Set-Content $dbDumpFile -Encoding UTF8
        if ((Test-Path $dbDumpFile) -and (Get-Item $dbDumpFile).Length -gt 0) {
            $dbOk = $true
            Write-Host "        DB dump: $([Math]::Round((Get-Item $dbDumpFile).Length/1KB, 1)) KB"
        } else {
            Write-Host "        SKIPPED — pg_dump produced no output" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "        SKIPPED — pg_dump failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "        SKIPPED — no k8s access this run" -ForegroundColor Yellow
}

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
    dbDumpCaptured       = $dbOk
    dbDumpSizeKB         = if ($dbOk) { [Math]::Round((Get-Item $dbDumpFile).Length/1KB, 1) } else { 0 }
}
$meta | ConvertTo-Json -Depth 5 | Set-Content "$ptDir\metadata.json" -Encoding UTF8

# ── Append to BACKUP_HISTORY.md ──────────────────────────────────────────────
$histEntry = @"

## $(Get-Date -Format "yyyy-MM-dd HH:mm:ss") — $Description

- **ID**: $($meta.id)
- **Reason**: $Reason
- **Repo commit**: $($repoCommit.ToString().Trim().Substring(0,8)) ($repoBranch)
- **K8s state captured**: $k8sOk
- **DB dump**: $(if ($dbOk) { "$($meta.dbDumpSizeKB) KB" } else { "SKIPPED (no cluster access this run)" })
- **Impact**: $ExpectedImpact
- **Files affected**: $($FilesAffected -join ', ')
- **Rollback**: ``.\Invoke-Rollback.ps1 -PointId "$($meta.id)"``

"@
Add-Content $HISTORY $histEntry -Encoding UTF8

if ($k8sOk -and $dbOk) {
    Write-Host "`n✅ Recovery point created (full): $($meta.id)" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Recovery point created (PARTIAL — code state only, no DB/k8s snapshot): $($meta.id)" -ForegroundColor Yellow
    Write-Host "   Open a Bastion tunnel and re-run for a complete recovery point before a HIGH risk change." -ForegroundColor Yellow
}
Write-Host "   To restore: .\Invoke-Rollback.ps1 -PointId `"$($meta.id)`""
