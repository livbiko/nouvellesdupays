<#
  Video landing page fix: /youtube/<slug> fetches the video fresh on every request, so a suspended/rejected
  video 404s immediately instead of staying public from the Next.js cache until the web pods restart.
  Web only - no API / worker / DB change, so no DB backup; the recovery point is the current web image.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 save current web image | 4 merge | 6 build web, roll out web | 7 verify pages | 8 Test-Build
  Rollback: kubectl set image deployment/nouvellesdupays-web web=<image in old-web-image.txt>
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/video-page-fresh'

# Plain function using $args; a bare -- is swallowed by PowerShell, so it is always written '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Code($url) { try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30).StatusCode } catch { [int]$_.Exception.Response.StatusCode } }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
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

  if ($From -le 6) {
    Step 6 'build web, roll out web'
    K delete job kaniko-build-nouvellesdupays-web --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-web.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-web --timeout=1200s | Out-Null
    K rollout restart deployment/nouvellesdupays-web | Out-Null
    K rollout status deployment/nouvellesdupays-web --timeout=300s | Out-Null
    $newWeb = K get pods -l app=nouvellesdupays-web -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ($newWeb -eq (Get-Content old-web-image.txt)) { throw 'web image did not change - new build not picked up' }
    Ok 'web rolled out on new image'
  }

  if ($From -le 7) {
    Step 7 'verify video pages'
    $site = 'https://nouvellesdupays.com'
    $live = ((Invoke-WebRequest "$site/api/youtube/videos" -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json) | Select-Object -First 1
    $checks = @(
      @('/youtube', 200),
      @("/youtube/$($live.slug)", 200),
      @('/youtube/me-at-the-zoo', 404)  # suspended 2026-10-08
    )
    foreach ($c in $checks) {
      $got = Code "$site$($c[0])"
      if ($got -ne $c[1]) { throw "$($c[0]) returned $got, expected $($c[1])" }
      Ok "$($c[0]) -> $got"
    }
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
