<#
  Build #117 - Publisher search page (/publishers).
  New GET /api/publishers endpoint + new /publishers Next.js page.
  Changes:
    - apps/api/src/routes.js       GET /api/publishers (q, limit params)
    - apps/web/src/lib/types.ts    PublisherSearchResult interface
    - apps/web/src/lib/serverApi.ts publisherSearch() method
    - apps/web/src/app/publishers/page.tsx  new page

  Risk: MEDIUM (new endpoint + new page; no DB migration).
  Steps: 1 recovery-point + digests | 2 build api+web | 3 rollout | 4 verify | 5 Set-KnownGood
  Resume: .\Run-Release.ps1 -From <step>
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:	ools\oci-cliin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Repo = 'lhr.ocir.io/lr14abpkfrxj'
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed" }; $out }
function Step($n, $t) { Write-Host "`n=== Step $n - $t  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function JobDone($name, $min) {
  for ($i = 0; $i -lt ($min * 3); $i++) {
    $s = & kubectl @ctx get job $name -o 'jsonpath={.status.succeeded} {.status.failed}' 2>$null
    if ($s -match '^1') { return 'succeeded' }
    if ($s -match '\d$') { return 'failed' }
    Start-Sleep 20
  }; return 'timeout'
}
function Get-Page($url) { try { $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 40; @{ code = [int]$r.StatusCode; body = $r.Content } } catch { @{ code = 0; body = '' } } }

& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  if ($From -le 1) {
    Step 1 'recovery point + save api/web image digests'
    Push-Location "..\scripts"
    .\New-RecoveryPoint.ps1 -Description 'Before: Build #117 publisher search page'
    $rpExit = $LASTEXITCODE; Pop-Location
    if ($rpExit -eq 1) { throw 'Recovery point failed' }
    if ($rpExit -eq 2) { Write-Host "  WARN: recovery point PARTIAL" -ForegroundColor Yellow }
    foreach ($svc in 'api', 'web') {
      $img = & kubectl @ctx get pods -l "app=nouvellesdupays-$svc" --field-selector=status.phase=Running `
        -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" 2>$null
      if ($img -notmatch '@(sha256:[0-9a-f]+)') { throw "could not read current $svc image" }
      "$Repo/nouvellesdupays-$svc@$($Matches[1])" | Set-Content "old-$svc-image.txt"
      Ok "rollback $svc image ...$($Matches[1].Substring($Matches[1].Length - 12))"
    }
  }

  if ($From -le 2) {
    Step 2 'build api + web'
    foreach ($svc in 'api', 'web') {
      K delete job "kaniko-build-nouvellesdupays-$svc" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$svc.yaml" | Out-Null
      $r = JobDone "kaniko-build-nouvellesdupays-$svc" 25
      if ($r -ne 'succeeded') { throw "kaniko $svc build $r" }
      Ok "$svc image built"
    }
  }

  if ($From -le 3) {
    Step 3 'rollout api + web'
    foreach ($svc in 'api', 'web') {
      K rollout restart "deployment/nouvellesdupays-$svc" | Out-Null
      K rollout status  "deployment/nouvellesdupays-$svc" --timeout=300s | Out-Null
      $oldImg = Get-Content "old-$svc-image.txt" -ErrorAction SilentlyContinue
      $oldDigest = if ($oldImg -match '@(sha256:[0-9a-f]+)') { $Matches[1] } else { $null }
      if ($oldDigest) {
        $stale = $true
        for ($w = 0; $w -lt 12 -and $stale; $w++) {
          $ids = K get pods -l "app=nouvellesdupays-$svc" --field-selector=status.phase=Running `
            -o "jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{\n}{end}"
          $stale = [bool]($ids | Where-Object { $_ -match [regex]::Escape($oldDigest) })
          if ($stale) { Start-Sleep 10 }
        }
        if ($stale) { throw "$svc pods still run old image after rollout" }
      }
      Ok "$svc rolled out"
    }
  }

  if ($From -le 4) {
    Step 4 'verify'
    $site = 'https://nouvellesdupays.com'
    $rPub = Get-Page "$site/publishers"
    if ($rPub.code -ne 200) { throw "/publishers -> $($rPub.code)" }
    Ok "/publishers -> 200"
    $rApi = Get-Page "$site/api/publishers?limit=5"
    if ($rApi.code -ne 200) { throw "/api/publishers -> $($rApi.code)" }
    if ($rApi.body -notmatch '"slug"') { throw "/api/publishers missing slug field" }
    Ok "/api/publishers -> 200, slug present"
    foreach ($u in '/', '/africa', '/africa/rankings', '/source/seneweb') {
      $r = Get-Page "$site$u"; if ($r.code -ne 200) { throw "$u -> $($r.code)" }
    }
    Ok "regressions /, /africa, /africa/rankings, /source/seneweb -> 200"
  }

  if ($From -le 5) {
    Step 5 'Set-KnownGood'
    Push-Location "..\scripts"
    .\Set-KnownGood.ps1 -BuildNote 'Build #117: publisher search page (/publishers) + GET /api/publishers'
    $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw 'Set-KnownGood refused' }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  foreach ($svc in 'api', 'web') {
    $oldImg = Get-Content "old-$svc-image.txt" -ErrorAction SilentlyContinue
    if ($oldImg) { Write-Host "  Rollback ${svc}: kubectl set image deployment/nouvellesdupays-${svc} ${svc}=$oldImg" -ForegroundColor Yellow }
  }
}
finally { & .\Stop-OkeTunnel.ps1 }
