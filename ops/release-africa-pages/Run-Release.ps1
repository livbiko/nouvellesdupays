<#
  Public Africa pages (MEDIUM): /africa, /africa/<region>, /africa/<country> + sitemap, footer and globe-panel links.
  API: two new read-only endpoints (/api/africa/summary, /api/africa/regions/:region/articles). No schema/data change,
  no migration. API + web images rebuilt and rolled out.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 recovery point (api/web images) | 4 merge | 5 build api + web | 6 roll out api, then web | 7 verify | 8 Test-Build
  Rollback: kubectl set image deployment/nouvellesdupays-api|web <container>=<old-*-image.txt>
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/africa-pages'

# Tunnel/auth blips are retried for verbs that are safe to repeat - never for exec/create.
function K {
  $retryable = @('cp', 'get', 'wait', 'logs', 'apply', 'delete') -contains $args[0]
  for ($try = 1; ; $try++) {
    $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }
    if ($LASTEXITCODE -eq 0) { return $out }
    $transient = "$out" -match 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout'
    if (-not ($retryable -and $transient -and $try -lt 4)) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }
    Write-Host "  (kubectl $($args[0]) - tunnel blip, retry $try/3 in 10s)" -ForegroundColor Yellow
    Start-Sleep 10
  }
}
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Image($app) { K get pods -l "app=nouvellesdupays-$app" -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" }
function Code($url) { try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 60).StatusCode } catch { [int]$_.Exception.Response.StatusCode } }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'recovery point (current api/web images)'
    foreach ($app in 'api', 'web') {
      $img = Image $app
      if ("$img" -notmatch '@sha256:') { throw "could not read current $app image ('$img')" }
      $img | Set-Content "old-$app-image.txt"
      Ok "rollback $app image: $($img.Substring($img.Length-12))"
    }
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
    Step 5 'build api + web'
    foreach ($app in 'api', 'web') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      K wait --for=condition=complete "job/kaniko-build-nouvellesdupays-$app" --timeout=1200s | Out-Null
      Ok "$app image built"
    }
  }

  if ($From -le 6) {
    Step 6 'roll out api, then web (the pages need the new endpoints)'
    foreach ($app in 'api', 'web') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      if ((Image $app) -eq (Get-Content "old-$app-image.txt")) { throw "$app image did not change - new build not picked up" }
      Ok "$app rolled out on new image"
    }
  }

  if ($From -le 7) {
    Step 7 'verify'
    $site = 'https://nouvellesdupays.com'
    $checks = @(
      @('/api/africa/summary', 200), @('/api/africa/regions/West%20Africa/articles', 200),
      @('/africa', 200), @('/africa/west-africa', 200), @('/africa/east-africa', 200),
      @('/africa/cote-divoire', 200), @('/africa/nigeria', 200), @('/africa/somalia', 200),
      @('/africa/france', 404), @('/africa/nowhere', 404),
      @('/', 200), @('/youtube', 200)
    )
    foreach ($c in $checks) {
      $got = Code "$site$($c[0])"
      if ($got -ne $c[1]) { throw "$($c[0]) returned $got, expected $($c[1])" }
      Ok "$($c[0]) -> $got"
    }
    $sum = (Invoke-WebRequest "$site/api/africa/summary" -UseBasicParsing -TimeoutSec 60).Content | ConvertFrom-Json
    $n = ($sum.regions | ForEach-Object { $_.countries.Count } | Measure-Object -Sum).Sum
    Ok "summary: $($sum.regions.Count) regions, $n countries"
    $ci = (Invoke-WebRequest "$site/africa/cote-divoire" -UseBasicParsing -TimeoutSec 60).Content
    foreach ($needle in 'Dernières actualités', 'Les médias du pays', 'Autres pays') {
      if ($ci -notmatch [regex]::Escape($needle)) { throw "/africa/cote-divoire is missing '$needle'" }
    }
    Ok '/africa/cote-divoire has news, media and neighbour sections'
    $sm = (Invoke-WebRequest "$site/sitemap.xml" -UseBasicParsing -TimeoutSec 60).Content
    if ($sm -notmatch '/africa/cote-divoire') { throw 'sitemap.xml does not list the country pages' }
    Ok 'sitemap lists the Africa pages'
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
