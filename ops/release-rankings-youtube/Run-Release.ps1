<#
  Build #111 - YouTube audience fetcher + /africa/rankings page (spec sections 9, 16, 17).
  Code changes (no migration, all tables exist from migration 016):
    - apps/worker/src/youtube-audience.js       (new) YouTube Data API v3 channel stats fetcher
    - apps/worker/src/youtube-audience-once.js  (new) k8s CronJob one-shot entry
    - apps/worker/src/index.js                  weekly cron at YT_AUDIENCE_SCHEDULE (default Sun 03:00 UTC)
    - apps/api/src/rankings.js                  (new) GET /api/rankings + GET /api/rankings/:platform
    - apps/api/src/routes.js                    registerRankingsRoutes
    - apps/api/src/admin.js                     GET /api/admin/youtube-audience/status
    - apps/web/src/app/africa/rankings/page.tsx (new) /africa/rankings page
    - apps/web/src/lib/serverApi.ts + types.ts  RankingsData, rankings() API call
    - apps/web/src/app/africa/page.tsx          Rankings nav pill
    - apps/web/src/app/sitemap.ts               /africa/rankings in sitemap
    - .env.example                              YT_AUDIENCE_SCHEDULE documented

  Risk: MEDIUM (new public routes, new worker schedule, no DB migration).
  Requires: no migration; YOUTUBE_API_KEY in .env is optional at deploy (page shows "waiting for data").
  Rollback: kubectl set image deployment/nouvellesdupays-api api=<old-api-image.txt>;
            kubectl set image deployment/nouvellesdupays-web web=<old-web-image.txt>;
            kubectl set image deployment/nouvellesdupays-worker worker=<old-worker-image.txt>
  Steps: 1 recovery point + save image digests | 2 build api + web + worker | 3 roll out all three
         4 verify endpoints and pages | 5 Test-Build + Set-KnownGood
  Resume: .\Run-Release.ps1 -From <step>
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Repo = 'lhr.ocir.io/lr14abpkfrxj'
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Image($app) { K get pods -l "app=nouvellesdupays-$app" -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" }
function JobDone($name, $minutes) {
  for ($i = 0; $i -lt ($minutes * 3); $i++) {
    $s = & kubectl @ctx get job $name -o 'jsonpath={.status.succeeded} {.status.failed}' 2>$null
    if ($s -match '^1') { return 'succeeded' } elseif ($s -match '\d$') { return 'failed' }
    Start-Sleep 20
  }
  return 'timeout'
}
function Get-Page($url) { try { $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 40; @{ code = [int]$r.StatusCode; body = $r.Content } } catch { @{ code = [int]$_.Exception.Response.StatusCode; body = '' } } }

& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  if ($From -le 1) {
    Step 1 'recovery point + save api/web/worker image digests'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #111 YouTube audience fetcher + rankings page (api + web + worker)"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing changed" }
    foreach ($app in 'api', 'web', 'worker') {
      $img = "$(Image $app)"
      if ($img -notmatch '@(sha256:[0-9a-f]+)') { throw "could not read current $app image ('$img')" }
      "$Repo/nouvellesdupays-$app@$($Matches[1])" | Set-Content "old-$app-image.txt"
      Ok "rollback $app image ...$($Matches[1].Substring($Matches[1].Length - 12))"
    }
  }

  if ($From -le 2) {
    Step 2 'build api + web + worker images'
    foreach ($app in 'api', 'web', 'worker') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      $r = JobDone "kaniko-build-nouvellesdupays-$app" 25
      if ($r -ne 'succeeded') { throw "kaniko $app build $r - kubectl logs job/kaniko-build-nouvellesdupays-$app" }
      Ok "$app image built"
    }
  }

  if ($From -le 3) {
    Step 3 'roll out api + web + worker'
    foreach ($app in 'api', 'web', 'worker') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status  "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      $oldDigest = ((Get-Content "old-$app-image.txt") -split '@')[1]
      $stale = $true
      for ($w = 0; $w -lt 12 -and $stale; $w++) {
        $ids = K get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running -o "jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{'\n'}{end}"
        $stale = [bool]($ids | Where-Object { $_ -match [regex]::Escape($oldDigest) })
        if ($stale) { Start-Sleep 10 }
      }
      if ($stale) { throw "$app pods still run the old image after rollout" }
      Ok "$app rolled out"
    }
  }

  if ($From -le 4) {
    Step 4 'verify endpoints and pages'
    $site = 'https://nouvellesdupays.com'

    # Rankings API — returns the three lists (can be empty until API key is set)
    $r = Get-Page "$site/api/rankings"
    if ($r.code -ne 200) { throw "/api/rankings -> $($r.code)" }
    if ($r.body -notmatch '"youtube_by_subscribers"' -or $r.body -notmatch '"youtube_by_views"' -or $r.body -notmatch '"all_by_followers"') {
      throw "/api/rankings missing expected keys"
    }
    Ok "/api/rankings -> 200 (all three list keys present)"

    # Platform-specific endpoint
    $p = Get-Page "$site/api/rankings/youtube"
    if ($p.code -ne 200) { throw "/api/rankings/youtube -> $($p.code)" }
    Ok "/api/rankings/youtube -> 200"

    # Unknown platform → 404
    if ((Get-Page "$site/api/rankings/snapchat").code -ne 404) { throw "/api/rankings/snapchat should be 404" }
    Ok "/api/rankings/snapchat -> 404"

    # Rankings page — must load even when no data
    $rp = Get-Page "$site/africa/rankings"
    if ($rp.code -ne 200) { throw "/africa/rankings -> $($rp.code)" }
    if ($rp.body -notmatch 'Classements' -and $rp.body -notmatch 'classements') { throw "/africa/rankings: 'Classements' not found on page" }
    Ok "/africa/rankings -> 200"

    # Africa index still has the rankings link
    $af = Get-Page "$site/africa"
    if ($af.code -ne 200 -or $af.body -notmatch '/africa/rankings') { throw "/africa -> $($af.code) or rankings link missing" }
    Ok "/africa -> 200, rankings link present"

    # Sitemap lists /africa/rankings
    $sm = Get-Page "$site/sitemap.xml"
    if ($sm.code -ne 200 -or $sm.body -notmatch 'africa/rankings') { throw "sitemap.xml: /africa/rankings missing" }
    Ok "sitemap.xml lists /africa/rankings"

    # Existing source pages still work
    $s = Get-Page "$site/source/daily-maverick"
    if ($s.code -ne 200) { throw "/source/daily-maverick -> $($s.code)" }
    Ok "/source/daily-maverick -> 200"

    # Regression: existing routes still respond
    foreach ($u in '/', '/africa', '/youtube') { $r2 = Get-Page "$site$u"; if ($r2.code -ne 200) { throw "$u -> $($r2.code)" } }
    Ok '/, /africa, /youtube regressions -> 200'
  }

  if ($From -le 5) {
    Step 5 'Test-Build + Set-KnownGood'
    Push-Location ..\scripts
    .\Set-KnownGood.ps1 -BuildNote "Build #111: YouTube audience fetcher (worker) + GET /api/rankings + /africa/rankings page (api + web + worker)"
    $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg)" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Rollback: kubectl set image deployment/nouvellesdupays-api api=<content of old-api-image.txt>" -ForegroundColor Yellow
  Write-Host "          kubectl set image deployment/nouvellesdupays-web web=<content of old-web-image.txt>" -ForegroundColor Yellow
  Write-Host "          kubectl set image deployment/nouvellesdupays-worker worker=<content of old-worker-image.txt>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }
