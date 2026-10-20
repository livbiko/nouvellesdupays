<#
  Build #115 - Featured publishers section on /africa landing page.
  No DB migration, no API changes. Changes:
    - apps/web/src/app/africa/page.tsx  Medias recommandes grid (top 8 editorial_by_overall)

  Risk: LOW (pure UI addition, gracefully absent when no scores exist).
  Rollback web: kubectl set image deployment/nouvellesdupays-web web=<old-web-image.txt>
  Steps: 1 save web digest | 2 build web | 3 rollout web | 4 verify | 5 Set-KnownGood
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
    Step 1 'save web image digest'
    $img = & kubectl @ctx get pods -l "app=nouvellesdupays-web" --field-selector=status.phase=Running `
      -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" 2>$null
    if ($img -notmatch '@(sha256:[0-9a-f]+)') { throw "could not read current web image" }
    "$Repo/nouvellesdupays-web@$($Matches[1])" | Set-Content "old-web-image.txt"
    Ok "rollback web image ...$($Matches[1].Substring($Matches[1].Length - 12))"
  }

  if ($From -le 2) {
    Step 2 'build web'
    K delete job "kaniko-build-nouvellesdupays-web" --ignore-not-found | Out-Null
    K apply -f "..\..\infra\k8s\ci\kaniko-build-web.yaml" | Out-Null
    $r = JobDone "kaniko-build-nouvellesdupays-web" 25
    if ($r -ne 'succeeded') { throw "kaniko web build $r" }
    Ok "web image built"
  }

  if ($From -le 3) {
    Step 3 'rollout web'
    K rollout restart "deployment/nouvellesdupays-web" | Out-Null
    K rollout status  "deployment/nouvellesdupays-web" --timeout=300s | Out-Null
    $oldImg = Get-Content "old-web-image.txt" -ErrorAction SilentlyContinue
    $oldDigest = if ($oldImg -match '@(sha256:[0-9a-f]+)') { $Matches[1] } else { $null }
    if ($oldDigest) {
      $stale = $true
      for ($w = 0; $w -lt 12 -and $stale; $w++) {
        $ids = K get pods -l "app=nouvellesdupays-web" --field-selector=status.phase=Running `
          -o "jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{'\n'}{end}"
        $stale = [bool]($ids | Where-Object { $_ -match [regex]::Escape($oldDigest) })
        if ($stale) { Start-Sleep 10 }
      }
      if ($stale) { throw "web pods still run old image after rollout" }
    }
    Ok "web rolled out"
  }

  if ($From -le 4) {
    Step 4 'verify'
    $site = 'https://nouvellesdupays.com'
    # /africa page should load; /api/rankings should still return editorial_by_overall
    foreach ($u in '/africa', '/', '/africa/rankings', '/source/seneweb') {
      $r = Get-Page "$site$u"; if ($r.code -ne 200) { throw "$u -> $($r.code)" }
    }
    Ok 'regressions /africa, /, /africa/rankings, /source/seneweb -> 200'
    $rr = Get-Page "$site/api/rankings"
    if ($rr.code -ne 200 -or $rr.body -notmatch '"editorial_by_overall"') { throw "/api/rankings missing editorial_by_overall" }
    Ok "/api/rankings -> 200, editorial_by_overall present"
  }

  if ($From -le 5) {
    Step 5 'Set-KnownGood'
    Push-Location ..\scripts
    .\Set-KnownGood.ps1 -BuildNote "Build #115: featured publishers grid on /africa landing page"
    $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  $oldWeb = Get-Content 'old-web-image.txt' -ErrorAction SilentlyContinue
  if ($oldWeb) { Write-Host "  Rollback web: kubectl set image deployment/nouvellesdupays-web web=$oldWeb" -ForegroundColor Yellow }
}
finally { & .\Stop-OkeTunnel.ps1 }
