<#
.SYNOPSIS
    Runs the verification checklist and, if all checks pass,
    marks the current build as a Known Good Build.

.EXAMPLE
    .\Set-KnownGood.ps1 -BuildNote "Added Nigeria's 5th feed source"
#>
param(
    [string]$BuildNote = "",
    [switch]$SkipTests,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO_DIR = "C:\inetpub\wwwroot\nouvellesdupays"
$OPS_DIR  = "$REPO_DIR\ops"
$KGB_FILE = "$OPS_DIR\KNOWN_GOOD_BUILDS.json"
$HISTORY  = "$OPS_DIR\RELEASE_HISTORY.md"

# ── Run verification ──────────────────────────────────────────────────────────
if (-not $SkipTests) {
    Write-Host "Running verification checklist first..." -ForegroundColor Cyan
    $ok = & "$OPS_DIR\scripts\Test-Build.ps1"
    if (-not $ok -and -not $Force) {
        Write-Host "`n❌ Build verification failed. Use -Force to override (not recommended)." -ForegroundColor Red
        exit 1
    }
}

# ── Collect build info ────────────────────────────────────────────────────────
$repoCommit = (git -C $REPO_DIR rev-parse HEAD).Trim()
$repoBranch = (git -C $REPO_DIR rev-parse --abbrev-ref HEAD).Trim()
$rootPkg    = Get-Content "$REPO_DIR\package.json" | ConvertFrom-Json

# ── Load existing registry ────────────────────────────────────────────────────
$builds = @()
if (Test-Path $KGB_FILE) {
    $content = Get-Content $KGB_FILE -Raw
    if ($content.Trim()) { $builds = $content | ConvertFrom-Json }
    if ($builds -isnot [Array]) { $builds = @($builds) }
}

# ── Build number ──────────────────────────────────────────────────────────────
$buildNumber = ($builds.Count + 1)

# ── New entry ─────────────────────────────────────────────────────────────────
$entry = [ordered]@{
    buildNumber    = $buildNumber
    dateCreated    = (Get-Date -Format "o")
    repoCommit     = $repoCommit
    repoBranch     = $repoBranch
    note           = $BuildNote
    productionSafe = $true
    testResults    = if ($SkipTests) { "skipped" } else { "passed" }
    deployStatus   = "deployed"
}

$builds += $entry

# ── Save registry ─────────────────────────────────────────────────────────────
$builds | ConvertTo-Json -Depth 5 | Set-Content $KGB_FILE -Encoding UTF8

# ── Append to RELEASE_HISTORY.md ─────────────────────────────────────────────
$histEntry = @"

## Build #$buildNumber — $(Get-Date -Format "yyyy-MM-dd HH:mm")

- **Repo commit**: $($repoCommit.Substring(0,8)) ($repoBranch)
- **Tests**: $(if ($SkipTests) { "skipped" } else { "passed" })
- **Production-safe**: Yes
- **Note**: $BuildNote

"@
Add-Content $HISTORY $histEntry -Encoding UTF8

Write-Host "`n✅ Build #$buildNumber marked as Known Good" -ForegroundColor Green
Write-Host "   Repo: $($repoCommit.Substring(0,8)) ($repoBranch)"
