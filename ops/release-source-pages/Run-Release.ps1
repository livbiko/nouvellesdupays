<#
  Build #110 - /source/<slug> pages (owner's "Africa Media Discovery" spec, section 15). Code: GET /api/sources/:slug and
  GET /api/sources (apps/api/src/routes.js), slug on /api/countries/:iso/publishers, web page app/source/[slug],
  SourceCardGrid links the publisher name, sitemap lists source pages. Reads only migration-016 data; writes nothing.
  Checked before release: the endpoint's queries run read-only on production (semana, daily-maverick), web tsc clean.
  API tests written (apps/api/test/sources.test.js) but not run: no local test database on this server.
  One tunnel, always closed. Stop-on-failure; resume with .\Run-Release.ps1 -From <step>
  Steps: 1 recovery point + save api/web image digests | 2 merge | 3 build api + web | 4 roll out api + web
         5 verify public endpoints and pages | 6 Test-Build + Set-KnownGood
  Rollback: kubectl set image deployment/nouvellesdupays-api api=<old-api-image.txt>, same for web (container "web");
            ':latest' + rollout undo would pull the new image again, so pin the saved digests.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Branch = 'feat/source-pages'
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
    Step 1 'recovery point + save api/web image digests'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #110 /source/<slug> pages (api + web)"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing changed" }
    foreach ($app in 'api', 'web') {
      $img = "$(Image $app)"
      if ($img -notmatch '@(sha256:[0-9a-f]+)') { throw "could not read current $app image ('$img')" }
      "$Repo/nouvellesdupays-$app@$($Matches[1])" | Set-Content "old-$app-image.txt"
      Ok "rollback $app image ...$($Matches[1].Substring($Matches[1].Length - 12))"
    }
  }

  if ($From -le 2) {
    Step 2 "merge $Branch into main"
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { Pop-Location; throw 'git fetch failed' }
    git merge-base --is-ancestor origin/main "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'main has moved: fast-forward impossible - STOP' }
    Write-Host 'Commits to merge:'; git log --oneline "origin/main..origin/$Branch"
    git checkout -q main; git merge -q --ff-only origin/main; git merge --ff-only "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'merge failed' }
    git push -q origin main; if ($LASTEXITCODE) { Pop-Location; throw 'push failed' }
    Ok "main is now $(git log --oneline -1)"
    Pop-Location
  }

  if ($From -le 3) {
    Step 3 'build api + web images'
    foreach ($app in 'api', 'web') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      $r = JobDone "kaniko-build-nouvellesdupays-$app" 25
      if ($r -ne 'succeeded') { throw "kaniko $app build $r - kubectl logs job/kaniko-build-nouvellesdupays-$app" }
      Ok "$app image built"
    }
  }

  if ($From -le 4) {
    Step 4 'roll out api + web'
    foreach ($app in 'api', 'web') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      # All pods, not items[0]: right after the rollout an old pod can still be listed while terminating
      # (2026-10-19: a false "did not change" on the api). Wait up to 2 min for none to run the old digest.
      $oldDigest = ((Get-Content "old-$app-image.txt") -split '@')[1]
      $stale = $true
      for ($w = 0; $w -lt 12 -and $stale; $w++) {
        $ids = K get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running -o "jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{'\n'}{end}"
        $stale = [bool]($ids | Where-Object { $_ -match [regex]::Escape($oldDigest) })
        if ($stale) { Start-Sleep 10 }
      }
      if ($stale) { throw "$app pods still run the old image after the rollout - new build not picked up" }
      Ok "$app rolled out on the new image"
    }
  }

  if ($From -le 5) {
    Step 5 'verify public endpoints and pages'
    $site = 'https://nouvellesdupays.com'
    $a = Get-Page "$site/api/sources/semana"
    if ($a.code -ne 200 -or $a.body -notmatch '"name":"Semana"' -or $a.body -notmatch '"articles":\[') { throw "/api/sources/semana -> $($a.code)" }
    Ok '/api/sources/semana -> 200 with articles'
    if ((Get-Page "$site/api/sources/no-such-source-xyz").code -ne 404) { throw '/api/sources/<unknown> is not a 404' }
    Ok '/api/sources/<unknown> -> 404'
    $idx = Get-Page "$site/api/sources"
    if ($idx.code -ne 200 -or ([regex]::Matches($idx.body, '"slug"')).Count -lt 500) { throw "/api/sources -> $($idx.code), too few slugs" }
    Ok "/api/sources -> $(([regex]::Matches($idx.body, '"slug"')).Count) slugs"
    $p = Get-Page "$site/source/daily-maverick"
    if ($p.code -ne 200 -or $p.body -notmatch 'Daily Maverick' -or $p.body -notmatch 'id="latest"') { throw "/source/daily-maverick -> $($p.code)" }
    Ok '/source/daily-maverick -> 200'
    if ((Get-Page "$site/source/no-such-source-xyz").code -ne 404) { throw '/source/<unknown> is not a 404' }
    Ok '/source/<unknown> -> 404'
    $c = Get-Page "$site/africa/ghana"
    if ($c.code -ne 200 -or $c.body -notmatch 'href="/source/') { throw "/africa/ghana -> $($c.code) or no /source/ links" }
    Ok '/africa/ghana -> 200 with /source/ links'
    $sm = Get-Page "$site/sitemap.xml"
    if ($sm.code -ne 200 -or $sm.body -notmatch '/source/') { throw 'sitemap.xml has no /source/ entries' }
    Ok 'sitemap.xml lists /source/ pages'
    foreach ($u in '/', '/africa', '/youtube') { $r = Get-Page "$site$u"; if ($r.code -ne 200) { throw "$u -> $($r.code)" } }
    Ok '/, /africa, /youtube -> 200'
  }

  if ($From -le 6) {
    Step 6 'Test-Build + Set-KnownGood (refuses if any check fails or is skipped)'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #110: /source/<slug> pages - GET /api/sources(/:slug), source links on country pages, sitemap (api + web)"; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg) - roll back api/web to old-*-image.txt" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Rollback: kubectl set image deployment/nouvellesdupays-api api=<old-api-image.txt>; deployment/nouvellesdupays-web web=<old-web-image.txt>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }
