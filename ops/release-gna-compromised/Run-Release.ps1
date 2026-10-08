<#
  Discovery worker: hacked-site rule + restore Ghana News Agency (MEDIUM, owner-approved 2026-10-08).
  Spam only in hidden injected links on a real news site -> 'compromised', kept for review (was: auto-rejected).
  Worker image only (no API/web/schema change) + one guarded data row (discovered_sources id 8).
  Order matters: the worker is rebuilt BEFORE the row is restored, so no old-image run can re-reject it.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 backups (full DB + row 8 + worker image) | 4 merge | 5 build worker | 6 restore row 8
         7 supervised discovery run + verify row 8 | 8 Test-Build
  Rollback: rollback_gna.sql (exact reverse, tested); worker image back to old-worker-image.txt.
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/discovery-compromised-sites'

# Plain function using $args; a bare -- is swallowed by PowerShell, so it is always written '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
# Relative paths on purpose: kubectl cp reads "C:\..." as pod "C".
function PsqlFile($file) {
  K cp $file "postgres-0:/tmp/$file" | Out-Null
  K exec postgres-0 '--' sh -c "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -At -f /tmp/$file 2>&1"
}
function Sql($q) { Set-Content -Path ndp-q.sql -Value $q -Encoding ASCII; PsqlFile 'ndp-q.sql' }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Row8 { "$(Sql "SELECT status || ' ' || health || ' ' || array_to_string(flags, ',') FROM discovered_sources WHERE id = 8;")".Trim() }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'backups (recovery point)'
    $r = Row8
    if ($r -notmatch '^rejected spam_suspect .*spam') { throw "row 8 is not in the expected state ('$r') - STOP and tell Claude" }
    $r | Set-Content row8-before.txt
    Ok "row 8 before: $r"
    $job = "ndp-backup-pre-gna-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^(nouvellesdupays-(worker|discovery)|ndp-discovery)' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if ($w) { ($w -split ' ')[1] | Set-Content old-worker-image.txt; Ok 'rollback worker image saved' }
    else { Write-Host '  (no finished worker pod to read the image from - rollback would use the previous OCIR digest)' -ForegroundColor Yellow }
  }

  if ($From -le 4) {
    Step 4 "merge $Branch into main"
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { throw 'git fetch failed' }
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
    Step 5 'build worker (before restoring the row)'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-worker --timeout=1200s | Out-Null
    Ok 'worker image built (next CronJob pods use it)'
  }

  if ($From -le 6) {
    Step 6 'restore row 8 (Ghana News Agency), one guarded transaction'
    $log = PsqlFile 'fix_gna.sql'
    if ($log -match 'ERROR') { throw "fix FAILED and was rolled back (nothing applied):`n$($log -join "`n")" }
    Ok "row 8 now: $(Row8)"
  }

  if ($From -le 7) {
    Step 7 'supervised discovery run on the new image + verify row 8'
    $job = "ndp-discovery-gna-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-discovery | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=1500s | Out-Null
    $dlog = K logs "job/$job"
    $done = $dlog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "discovery run did not finish cleanly:`n$(($dlog | Select-Object -Last 20) -join "`n")" }
    Ok "$done"
    $gna = $dlog | Where-Object { $_ -match 'gna\.org\.gh' }
    if ($gna) { Ok "re-checked by the new worker: $($gna.Trim())" }
    $r = Row8
    if ($r -notmatch '^under_review ok .*compromised' -or $r -match '(^|,)spam(,|$)') { throw "row 8 not as expected after the run: '$r'" }
    Ok "row 8 after the run: $r"
    $inv = "$(Sql "SELECT count(*) FROM discovered_sources WHERE status IN ('verified','contacted','invited','registered');")".Trim()
    Ok "outreach rows: $inv (expected 38)"
  }

  if ($From -le 8) {
    Step 8 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this to Claude. Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
