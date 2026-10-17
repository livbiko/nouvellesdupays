<#
  Admin publishers page: "silent" publishers (fetched fine, no article for 14 days) get an amber light instead of a green
  "OK", plus a "Silencieux" filter. 2026-10-17: 11 publishers had shown "OK" for weeks to years while producing nothing.
  Web only (apps/web/src/app/admin/publishers/page.tsx) - no API / worker / DB change, so no DB backup; the recovery
  point is the current web image (old-web-image.txt). Runs in one tunnel (always closed). Stop-on-failure; resume with
  .\Run-Release.ps1 -From <step>
  Steps: 3 save current web image | 4 merge branch | 6 build web, roll out | 7 verify page | 8 Test-Build + Set-KnownGood
  Rollback: kubectl set image deployment/nouvellesdupays-web web=<image in old-web-image.txt>
#>
param([int]$From = 3)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Branch = 'fix/admin-silent-publishers'

function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  Ok 'tunnel'

  if ($From -le 3) {
    Step 3 'save current web image (recovery point)'
    $web = K get pods -l app=nouvellesdupays-web -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ("$web" -notmatch '@sha256:') { throw "could not read current web image ('$web')" }
    $web | Set-Content old-web-image.txt
    Ok "rollback web image: $($web.Substring($web.Length-12))"
  }

  if ($From -le 4) {
    Step 4 "merge $Branch into main"
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

  if ($From -le 6) {
    Step 6 'build web, roll out web'
    K delete job kaniko-build-nouvellesdupays-web --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-web.yaml | Out-Null
    $done = $false
    for ($i = 0; $i -lt 30 -and -not $done; $i++) {   # poll (a single long 'kubectl wait' does not survive a tunnel blip)
      Start-Sleep 40
      $s = & kubectl @ctx get job kaniko-build-nouvellesdupays-web -o 'jsonpath={.status.succeeded} {.status.failed}' 2>$null
      if ($s -match '^1') { $done = $true } elseif ($s -match '\d$') { throw 'kaniko build job failed - kubectl logs job/kaniko-build-nouvellesdupays-web' }
    }
    if (-not $done) { throw 'kaniko build did not finish within 20 min' }
    Ok 'web image built'
    K rollout restart deployment/nouvellesdupays-web | Out-Null
    K rollout status deployment/nouvellesdupays-web --timeout=300s | Out-Null
    $newWeb = K get pods -l app=nouvellesdupays-web -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ($newWeb -eq (Get-Content old-web-image.txt)) { throw 'web image did not change - new build not picked up' }
    Ok 'web rolled out on new image'
  }

  if ($From -le 7) {
    Step 7 'verify the admin publishers page'
    $site = 'https://nouvellesdupays.com'
    $r = Invoke-WebRequest "$site/admin/publishers" -UseBasicParsing -TimeoutSec 30
    if ($r.StatusCode -ne 200) { throw "/admin/publishers returned $($r.StatusCode)" }
    $chunks = [regex]::Matches($r.Content, 'src="(/_next/static/chunks/[^"]+\.js)"') | ForEach-Object { $_.Groups[1].Value }
    $found = $false
    foreach ($c in $chunks) { if ((Invoke-WebRequest "$site$c" -UseBasicParsing -TimeoutSec 30).Content -match 'Silencieux') { $found = $true; break } }
    if (-not $found) { throw 'new page code ("Silencieux") not found in the served JS' }
    Ok "/admin/publishers -> 200, new filter present in $($chunks.Count) chunk(s) checked"
    foreach ($p in @('/', '/admin/login')) { $c = (Invoke-WebRequest "$site$p" -UseBasicParsing -TimeoutSec 30).StatusCode; if ($c -ne 200) { throw "$p returned $c" }; Ok "$p -> $c" }
  }

  if ($From -le 8) {
    Step 8 'Test-Build + Set-KnownGood (refuses if any check fails or is skipped)'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Admin publishers page: silent publishers (no article in 14 days) shown amber + 'Silencieux' filter (web only)"; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg) - roll back: kubectl set image deployment/nouvellesdupays-web web=$(Get-Content old-web-image.txt)" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }
