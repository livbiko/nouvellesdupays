<#
  Somalia sources (data) + future-dated articles fix (worker code), branch fix/future-dates-somalia.
  No code / schema / build. Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 backup + rollback image | 4 merge | 5 add Somali sources (one transaction) | 6 build worker | 7 Test-Build
  Rollback: rollback_somali_sources.sql (exact reverse, tested) + previous worker image (old-worker-image.txt).
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$Branch = 'fix/future-dates-somalia'
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
  foreach ($f in 'add_somali_sources.sql', 'rollback_somali_sources.sql') { K cp $f "postgres-0:/tmp/ndp-backup/$f" | Out-Null }

  if ($From -le 3) {
    Step 3 'backup (recovery point) + rollback image'
    $job = "ndp-backup-pre-somalia-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    $worker = (K get pods --sort-by=.metadata.creationTimestamp --no-headers -o "custom-columns=NAME:.metadata.name,IMAGE:.status.containerStatuses[0].imageID") |
      Where-Object { $_ -match '^nouvellesdupays-worker-' } | Select-Object -Last 1 | ForEach-Object { ($_ -split '\s+')[1] }
    if ("$worker" -notmatch '@sha256:') { throw "could not read current worker image ('$worker')" }
    $worker | Set-Content old-worker-image.txt
    Ok "rollback worker image: $($worker.Substring($worker.Length-12))"
  }

  if ($From -le 4) {
    Step 4 "merge $Branch into main"
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { Pop-Location; throw 'git fetch failed' }
    git merge-base --is-ancestor origin/main "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'main has moved: fast-forward impossible - STOP and tell Claude' }
    Write-Host 'Commits to merge:'; git log --oneline "origin/main..origin/$Branch"
    git checkout -q main; git merge -q --ff-only origin/main; git merge --ff-only "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'merge failed' }
    git push -q origin main; if ($LASTEXITCODE) { Pop-Location; throw 'push failed' }
    Ok "main is now $(git log --oneline -1)"
    Pop-Location
  }

  if ($From -le 5) {
    Step 5 'add 7 Somali sources, retire 3 dead ones (one guarded transaction)'
    $log = Psql 'add_somali_sources.sql'
    if ($log -match 'ERROR') { throw "Somali sources FAILED and were rolled back (nothing applied):`n$($log -join "`n")" }
    $log | Where-Object { $_ -match '\|' } | ForEach-Object { Write-Host "    $_" }
    Ok 'committed'
  }

  if ($From -le 6) {
    Step 6 'build worker (future-date fix); the CronJob picks it up on its next 5-minute run'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-worker --timeout=1200s | Out-Null
    Ok 'worker image built'
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
