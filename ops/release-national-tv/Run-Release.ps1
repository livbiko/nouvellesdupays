<#
  National TV additions (data only, HIGH per Get-ChangeRisk): 21 verified official channels, 20 African countries.
  No code / schema / build. Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 pre-check + backups | 5 insert (one transaction) | 6 verify | 7 Test-Build
  Rollback: rollback_national_tv.sql (removes exactly these 21 rows) or the full DB backup from step 3.
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')

# Plain function using $args; a bare -- is swallowed by PowerShell, so it is always written '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Psql($file) { K exec postgres-0 '--' sh -c "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -At -v ON_ERROR_STOP=1 -f /tmp/ndp-backup/$file 2>&1" }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  K exec postgres-0 '--' mkdir -p /tmp/ndp-backup | Out-Null
  foreach ($f in 'backup_video_channels.sql', 'add_national_tv.sql', 'check_national_tv.sql', 'rollback_national_tv.sql') {
    K cp $f "postgres-0:/tmp/ndp-backup/$f" | Out-Null
  }

  if ($From -le 3) {
    Step 3 'pre-check + backups (recovery point)'
    $pre = ("$(Psql 'check_national_tv.sql')").Trim()
    if ($pre -ne '0') { throw "pre-check: $pre of these channels already exist as national_tv - STOP and tell Claude (rollback would not be exact)" }
    Ok 'none of the 21 channels exist as national_tv yet'
    $job = "ndp-backup-pre-national-tv-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    Psql 'backup_video_channels.sql' | Out-Null
    K cp postgres-0:/tmp/ndp-backup/video_channels_pre_national_tv.csv video_channels_pre_national_tv.csv | Out-Null
    $vc = (Get-Content video_channels_pre_national_tv.csv).Count
    if ($vc -lt 100) { throw "video_channels backup looks too small ($vc lines)" }
    Ok "video_channels backup saved here ($vc lines)"
  }

  if ($From -le 5) {
    Step 5 'insert 21 National TV channels (one transaction)'
    $log = Psql 'add_national_tv.sql'
    if ($log -match 'ERROR') { throw "insert FAILED and was rolled back (nothing applied):`n$($log -join "`n")" }
    Ok 'committed'
  }

  if ($From -le 6) {
    Step 6 'verify'
    $n = ("$(Psql 'check_national_tv.sql')").Trim()
    if ($n -ne '21') { throw "expected 21 new national_tv rows, found '$n'" }
    Ok '21 National TV rows present'
  }

  if ($From -le 7) {
    Step 7 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this to Claude. Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
