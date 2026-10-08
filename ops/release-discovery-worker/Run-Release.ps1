<#
  Media discovery worker (MEDIUM): migration 015 (additive: discovered_sources columns + discovery_mining_log),
  new hourly CronJob nouvellesdupays-discovery (worker image), admin review page /admin/discovery + API.
  The worker only writes candidates/scores - never publishers or feeds; an admin promotes by hand.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 backups (full DB + images) | 4 merge | 5 build api -> migrate (015) | 6 build worker + web, roll out api + web
         7 install CronJob + one supervised run | 8 verify | 9 Test-Build
  Rollback: kubectl delete cronjob nouvellesdupays-discovery; set api/web images back to old-*-image.txt
            (worker: previous digest in old-worker-image.txt). 015 is additive - leaving it in place is harmless.
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/media-discovery-worker'

# Plain function using $args; a bare -- is swallowed by PowerShell, so it is always written '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
# SQL goes through a file in the pod: no nested-quote problems with psql -c.
# Relative path on purpose: kubectl cp reads "C:\..." as pod "C".
function Sql($q) {
  Set-Content -Path ndp-q.sql -Value $q -Encoding ASCII
  K cp ndp-q.sql postgres-0:/tmp/ndp-q.sql | Out-Null
  K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -At -v ON_ERROR_STOP=1 -f /tmp/ndp-q.sql'
}
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Image($app) { K get pods -l "app=nouvellesdupays-$app" -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" }
function Build($app) {
  K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
  K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
  K wait --for=condition=complete "job/kaniko-build-nouvellesdupays-$app" --timeout=1200s | Out-Null
  Ok "$app image built"
}
function Code($url) { try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30).StatusCode } catch { [int]$_.Exception.Response.StatusCode } }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'backups (recovery point)'
    $n = "$(Sql 'SELECT count(*) FROM discovered_sources;')".Trim()
    if ($n -ne '0') { throw "discovered_sources is not empty ($n rows) - STOP and tell Claude (the new unique domain index assumes it is empty)" }
    Ok 'discovered_sources empty (new unique index is safe)'
    $job = "ndp-backup-pre-discovery-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    foreach ($app in 'api', 'web') {
      $img = Image $app
      if ("$img" -notmatch '@sha256:') { throw "could not read current $app image ('$img')" }
      $img | Set-Content "old-$app-image.txt"
      Ok "rollback $app image: $($img.Substring($img.Length-12))"
    }
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^nouvellesdupays-worker-' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if ($w) { ($w -split ' ')[1] | Set-Content old-worker-image.txt; Ok "rollback worker image saved" }
    else { Write-Host '  (no finished worker pod to read the image from - rollback would use the previous OCIR digest)' -ForegroundColor Yellow }
    "$(Sql "SELECT count(*) FROM publishers WHERE feed_status = 'active';")".Trim() | Set-Content active-publishers-before.txt
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
    Step 5 'build api -> migrate (015)'
    Build 'api'
    K delete job nouvellesdupays-migrate --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\04-migrate-job.yaml | Out-Null
    K wait --for=condition=complete job/nouvellesdupays-migrate --timeout=600s | Out-Null
    $mlog = K logs job/nouvellesdupays-migrate
    if (-not ($mlog -match '015_media_discovery_worker') -or -not ($mlog -match 'Migrations complete') -or -not ($mlog -match 'Seed complete')) { throw "migrate log unexpected:`n$(($mlog | Select-Object -Last 15) -join "`n")" }
    $cols = "$(Sql "SELECT count(*) FROM information_schema.columns WHERE table_name = 'discovered_sources' AND column_name IN ('domain','health','score','next_check_at');")".Trim()
    if ($cols -ne '4') { throw "015 columns missing ($cols/4)" }
    Ok 'migration 015 applied'
  }

  if ($From -le 6) {
    Step 6 'build worker + web, roll out api + web'
    Build 'worker'
    Build 'web'
    foreach ($app in 'api', 'web') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      if ((Image $app) -eq (Get-Content "old-$app-image.txt")) { throw "$app image did not change - new build not picked up" }
      Ok "$app rolled out on new image"
    }
  }

  if ($From -le 7) {
    Step 7 'install discovery CronJob + one supervised run'
    K apply -f ..\..\infra\k8s\16-discovery-cronjob.yaml | Out-Null
    $job = "ndp-discovery-first-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-discovery | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=1500s | Out-Null
    $dlog = K logs "job/$job"
    $done = $dlog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "discovery run did not finish cleanly:`n$(($dlog | Select-Object -Last 20) -join "`n")" }
    Ok "$done"
  }

  if ($From -le 8) {
    Step 8 'verify'
    $site = 'https://nouvellesdupays.com'
    if ((Code "$site/api/admin/discovered-sources") -ne 401) { throw 'discovery admin API is not protected (expected 401)' }
    Ok '/api/admin/discovered-sources -> 401 without a token'
    foreach ($p in '/', '/admin/discovery', '/youtube') {
      $c = Code "$site$p"; if ($c -ne 200) { throw "$p returned $c" }; Ok "$p -> 200"
    }
    Ok "candidates by status: $((Sql 'SELECT status, count(*) FROM discovered_sources GROUP BY status ORDER BY 1;') -join ', ')"
    $before = if (Test-Path active-publishers-before.txt) { (Get-Content active-publishers-before.txt).Trim() } else { '?' }
    $after = "$(Sql "SELECT count(*) FROM publishers WHERE feed_status = 'active';")".Trim()
    if ($before -ne '?' -and $before -ne $after) { throw "active publishers changed $before -> $after - discovery must not touch publishers" }
    Ok "active publishers unchanged: $after"
  }

  if ($From -le 9) {
    Step 9 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this to Claude. Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
