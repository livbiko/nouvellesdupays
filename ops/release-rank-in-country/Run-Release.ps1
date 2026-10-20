<#
  Build #116 - Rank-in-country indicator on source pages.
  No DB migration. Changes:
    - apps/api/src/routes.js       rank_in_country + total_in_country in GET /api/sources/:slug
    - apps/web/src/lib/types.ts    SourceProfile: rank_in_country + total_in_country
    - apps/web/src/app/source/[slug]/page.tsx  Rang Xe sur N sources notees
    - apps/api/test/sources.test.js  rank assertions (null + scored cases)

  Risk: MEDIUM (additive API change, no DB migration, graceful null fallback).
  Rollback api: kubectl set image deployment/nouvellesdupays-api api=<old-api-image.txt>
  Rollback web: kubectl set image deployment/nouvellesdupays-web web=<old-web-image.txt>
  Steps: 1 recovery+digests | 2 build api+web | 3 rollout api+web | 4 verify | 5 Set-KnownGood
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
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #116 rank-in-country"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0 -and $rp -ne 2) { throw "New-RecoveryPoint exit $rp" }
    foreach ($app in 'api', 'web') {
      $img = & kubectl @ctx get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running `
        -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" 2>$null
      if ($img -notmatch '@(sha256:[0-9a-f]+)') { throw "could not read current $app image" }
      "$Repo/nouvellesdupays-$app@$($Matches[1])" | Set-Content "old-$app-image.txt"
      Ok "rollback $app image ...$($Matches[1].Substring($Matches[1].Length - 12))"
    }
  }

  if ($From -le 2) {
    Step 2 'build api + web'
    foreach ($app in 'api', 'web') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      $r = JobDone "kaniko-build-nouvellesdupays-$app" 25
      if ($r -ne 'succeeded') { throw "kaniko $app build $r" }
      Ok "$app image built"
    }
  }

  if ($From -le 3) {
    Step 3 'rollout api + web'
    foreach ($app in 'api', 'web') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status  "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      $oldImg = Get-Content "old-$app-image.txt" -ErrorAction SilentlyContinue
      $oldDigest = if ($oldImg -match '@(sha256:[0-9a-f]+)') { $Matches[1] } else { $null }
      if ($oldDigest) {
        $stale = $true
        for ($w = 0; $w -lt 12 -and $stale; $w++) {
          $ids = K get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running `
            -o "jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{'\n'}{end}"
          $stale = [bool]($ids | Where-Object { $_ -match [regex]::Escape($oldDigest) })
          if ($stale) { Start-Sleep 10 }
        }
        if ($stale) { throw "$app pods still run old image after rollout" }
      }
      Ok "$app rolled out"
    }
  }

  if ($From -le 4) {
    Step 4 'verify'
    $site = 'https://nouvellesdupays.com'
    # source endpoint should now include rank fields
    $r = Get-Page "$site/api/sources/seneweb"
    if ($r.code -ne 200) { throw "/api/sources/seneweb -> $($r.code)" }
    if ($r.body -notmatch '"rank_in_country"') { throw "rank_in_country missing from /api/sources/seneweb" }
    Ok "/api/sources/seneweb -> 200, rank_in_country present"
    # regressions
    foreach ($u in '/', '/africa', '/africa/rankings', '/source/seneweb') {
      $r2 = Get-Page "$site$u"; if ($r2.code -ne 200) { throw "$u -> $($r2.code)" }
    }
    Ok 'regressions /, /africa, /africa/rankings, /source/seneweb -> 200'
  }

  if ($From -le 5) {
    Step 5 'Set-KnownGood'
    Push-Location ..\scripts
    .\Set-KnownGood.ps1 -BuildNote "Build #116: rank-in-country indicator on source pages" -Force
    $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  $oldApi = Get-Content 'old-api-image.txt' -ErrorAction SilentlyContinue
  $oldWeb = Get-Content 'old-web-image.txt' -ErrorAction SilentlyContinue
  if ($oldApi) { Write-Host "  Rollback api: kubectl set image deployment/nouvellesdupays-api api=$oldApi" -ForegroundColor Yellow }
  if ($oldWeb) { Write-Host "  Rollback web: kubectl set image deployment/nouvellesdupays-web web=$oldWeb" -ForegroundColor Yellow }
}
finally { & .\Stop-OkeTunnel.ps1 }
