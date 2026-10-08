<#
  Publisher classification round 2 (data only): source_type for 396 publishers still 'OTHER'.
  No code / schema / build. Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 pre-check + backups | 5 update (one transaction) | 6 verify | 7 Test-Build
  Rollback: rollback_publisher_types.sql (sets exactly these rows back to OTHER) or the full DB backup from step 3.
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
  foreach ($f in 'precheck_publisher_types.sql', 'backup_publisher_types.sql', 'apply_publisher_types_round2.sql', 'check_publisher_types.sql', 'rollback_publisher_types.sql') {
    K cp $f "postgres-0:/tmp/ndp-backup/$f" | Out-Null
  }

  if ($From -le 3) {
    Step 3 'pre-check + backups (recovery point)'
    $pre = ((Psql 'precheck_publisher_types.sql') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1)
    if ("$pre" -ne '396') { throw "pre-check: $pre of the 396 publishers are still OTHER (expected 396) - production changed since the review; STOP and tell Claude" }
    Ok 'all 396 publishers are still OTHER'
    $job = "ndp-backup-pre-publisher-types-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    Psql 'backup_publisher_types.sql' | Out-Null
    K cp postgres-0:/tmp/ndp-backup/publisher_types_pre_round2.csv publisher_types_pre_round2.csv | Out-Null
    $pc = (Get-Content publisher_types_pre_round2.csv).Count
    if ($pc -lt 500) { throw "publisher types backup looks too small ($pc lines)" }
    Ok "publisher types backup saved here ($pc lines)"
  }

  if ($From -le 5) {
    Step 5 'classify 396 publishers (one transaction)'
    $log = Psql 'apply_publisher_types_round2.sql'
    if ($log -match 'ERROR') { throw "update FAILED and was rolled back (nothing applied):`n$($log -join "`n")" }
    Ok 'committed'
  }

  if ($From -le 6) {
    Step 6 'verify'
    $n = ((Psql 'check_publisher_types.sql') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1)
    if ("$n" -ne '396') { throw "expected 396 publishers with their new type, found '$n'" }
    Ok '396 publishers classified'
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
