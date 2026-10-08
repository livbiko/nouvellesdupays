<#
  Africa Voices + data cleanup release (HIGH risk) - all steps in one go, stop-on-failure.
  If anything stops it (tunnel drop, error): fix/reconnect, then resume with  .\Run-Release.ps1 -From <step>
  Steps: 2 tests | 3 backups (full DB + tables + images) | 4 merge | 5 build api, migrate, apply data
         6 build web, roll out api+web | 7 Test-Build
  Data step (5) is ONE transaction: on any error nothing is applied.
#>
param([int]$From = 2)
# 'Continue', not 'Stop': in PS 5.1 any native stderr line becomes a terminating error under 'Stop'.
$ErrorActionPreference = 'Continue'
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/africa-voices-data-cleanup'

# Plain function using $args (a [Parameter()] block would steal -o/-f/-l as common parameters).
# NB: a bare -- is swallowed by PowerShell when calling a function: always write it as '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function KC { $out = & kubectl --context tunnel-context @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 2) {
    Step 2 'tests in isolated pod (own Postgres)'
    & kubectl --context tunnel-context delete namespace ndp-ci --ignore-not-found --wait=true *> $null
    KC apply -f .\ci-test-pod.yaml | Out-Null
    # Wait for the TESTS container to terminate (the Postgres sidecar keeps the pod itself Running).
    $deadline = (Get-Date).AddMinutes(20)
    do { Start-Sleep 10; $term = & kubectl --context tunnel-context -n ndp-ci get pod ndp-api-tests -o "jsonpath={.status.containerStatuses[?(@.name=='tests')].state.terminated.exitCode}" 2>$null }
    until ("$term" -ne '' -or (Get-Date) -gt $deadline)
    if ("$term" -eq '') { throw 'tests did not finish within 20 minutes' }
    $log = KC -n ndp-ci logs ndp-api-tests -c tests
    $log | Select-Object -First 1; $log | Select-String '^# (tests|pass|fail)|TESTS EXIT CODE'
    if (-not ($log -match 'TESTS EXIT CODE: 0') -or -not ($log -match '^# fail 0')) { throw 'tests did not pass' }
    KC delete namespace ndp-ci | Out-Null
    Ok 'tests passed'
  }

  if ($From -le 3) {
    Step 3 'backups'
    $job = "ndp-backup-pre-africa-voices-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"

    K exec postgres-0 '--' mkdir -p /tmp/ndp-backup | Out-Null
    K cp backup_tables.sql postgres-0:/tmp/ndp-backup/backup_tables.sql | Out-Null
    K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -f /tmp/ndp-backup/backup_tables.sql'
    K cp postgres-0:/tmp/ndp-backup/video_channels.csv video_channels.csv | Out-Null
    K cp postgres-0:/tmp/ndp-backup/publishers_cols.csv publishers_cols.csv | Out-Null
    $vc = (Get-Content video_channels.csv).Count; $pc = (Get-Content publishers_cols.csv).Count
    if ($vc -lt 100 -or $pc -lt 100) { throw "table backups look too small (video_channels $vc lines, publishers $pc lines)" }
    Ok "table backups saved here (video_channels $vc lines, publishers $pc lines)"

    $api = K get pods -l app=nouvellesdupays-api -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    $web = K get pods -l app=nouvellesdupays-web -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ("$api$web" -notmatch '@sha256:.*@sha256:') { throw "could not read current images (api='$api' web='$web')" }
    $api | Set-Content old-api-image.txt; $web | Set-Content old-web-image.txt
    Ok "rollback images: api $($api.Substring($api.Length-12)), web $($web.Substring($web.Length-12))"
  }

  if ($From -le 4) {
    Step 4 "merge $Branch into main"
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { throw 'git fetch failed' }
    git merge-base --is-ancestor origin/main "origin/$Branch"
    if ($LASTEXITCODE) { throw 'main has moved: fast-forward impossible - STOP and tell Claude' }
    Write-Host 'Commits to merge:'; git log --oneline "origin/main..origin/$Branch"
    git checkout -q main; git merge -q --ff-only origin/main; git merge --ff-only "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'merge failed' }
    git push -q origin main; if ($LASTEXITCODE) { Pop-Location; throw 'push failed' }
    Ok "main is now $(git log --oneline -1)"
    Pop-Location
  }

  if ($From -le 5) {
    Step 5 'build api -> migrate (014) -> apply data cleanup'
    K delete job kaniko-build-nouvellesdupays-api --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-api --timeout=1200s | Out-Null
    Ok 'api image built'
    K delete job nouvellesdupays-migrate --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\04-migrate-job.yaml | Out-Null
    K wait --for=condition=complete job/nouvellesdupays-migrate --timeout=600s | Out-Null
    $mlog = K logs job/nouvellesdupays-migrate
    if (-not ($mlog -match '014_africa_voices') -or -not ($mlog -match 'Migrations complete') -or -not ($mlog -match 'Seed complete')) { throw "migrate log unexpected:`n$(($mlog | Select-Object -Last 15) -join "`n")" }
    Ok 'migration 014 + seed applied'
    Copy-Item ..\..\docs\media-discovery\phase1-review\apply_data_cleanup.sql . -Force
    K cp apply_data_cleanup.sql postgres-0:/tmp/ndp-backup/apply_data_cleanup.sql | Out-Null
    $dlog = K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -q -v ON_ERROR_STOP=1 -f /tmp/ndp-backup/apply_data_cleanup.sql 2>&1'
    if ($dlog -match 'ERROR') { throw "data cleanup FAILED and was rolled back (nothing applied):`n$($dlog -join "`n")" }
    K cp check_africa_voices.sql postgres-0:/tmp/ndp-backup/check_africa_voices.sql | Out-Null
    $av = K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -At -f /tmp/ndp-backup/check_africa_voices.sql'
    if ("$av".Trim() -ne '7') { throw "expected 7 africa_voices rows, got '$av'" }
    Ok 'data cleanup committed (7 Africa Voices rows)'
  }

  if ($From -le 6) {
    Step 6 'build web, roll out api + web'
    K delete job kaniko-build-nouvellesdupays-web --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-web.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-web --timeout=1200s | Out-Null
    K rollout restart deployment/nouvellesdupays-api deployment/nouvellesdupays-web | Out-Null
    K rollout status deployment/nouvellesdupays-api --timeout=300s | Out-Null
    K rollout status deployment/nouvellesdupays-web --timeout=300s | Out-Null
    $newWeb = K get pods -l app=nouvellesdupays-web -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ($newWeb -eq (Get-Content old-web-image.txt)) { throw 'web image did not change - new build not picked up' }
    Ok 'api + web rolled out on new images'
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
