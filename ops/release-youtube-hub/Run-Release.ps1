<#
  Build #122 - YouTube creator hub (/youtube page + /api/youtube/channels endpoint).
  No DB migration. Changes:
    - apps/api/src/routes.js         new GET /api/youtube/channels endpoint
    - apps/web/src/lib/types.ts      VideoChannel extended + VideoChannels import added
    - apps/web/src/lib/serverApi.ts  africaChannels() method
    - apps/web/src/app/youtube/page.tsx  creator hub replacing plain video grid

  Risk: MEDIUM (new API endpoint + frontend redesign, no DB migration).
  Rollback api: kubectl set image deployment/nouvellesdupays-api api=<old-api-image.txt>
  Rollback web: kubectl set image deployment/nouvellesdupays-web web=<old-web-image.txt>
  Steps: 1 recovery + digests | 2 build api+web | 3 rollout api+web | 4 verify | 5 Set-KnownGood
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
  Write-Host 'Waiting 60s for SSH tunnel...'
  Start-Sleep 60
  $sshPid = Get-Content "$PSScriptRoot\.ssh-tunnel-pid" -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 16; $i++) {
    & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null
    if ($LASTEXITCODE -eq 0) { break }
    $p = if ($sshPid) { Get-Process -Id ([int]$sshPid) -ErrorAction SilentlyContinue } else { $true }
    if (!$p) { throw 'SSH tunnel died' }
    Start-Sleep 15
  }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  Write-Host 'Tunnel up'

  if ($From -le 1) {
    Step 1 'recovery point + save api/web image digests'
    Push-Location ..\scripts
    .\New-RecoveryPoint.ps1 -Description "Before: Build #122 YouTube creator hub"
    $rp = $LASTEXITCODE; Pop-Location
    if ($rp -eq 1) { throw "New-RecoveryPoint failed" }
    if ($rp -eq 2) { Write-Host "  WARN: recovery point PARTIAL" -ForegroundColor Yellow }
    foreach ($app in 'api', 'web') {
      $img = ''; $tries = 0
      while ($img -notmatch '@sha256:' -and $tries -lt 6) {
        $tries++
        $img = [string](& kubectl @ctx get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running `
          -o "jsonpath={.items[0].status.containerStatuses[0].imageID}" 2>$null)
        if ($img -notmatch '@sha256:' -and $tries -lt 6) { Start-Sleep 10 }
      }
      if ($img -match '@(sha256:[0-9a-f]+)') {
        "$Repo/nouvellesdupays-$app@$($Matches[1])" | Set-Content "old-$app-image.txt"
        Ok "rollback $app image ...$($Matches[1].Substring($Matches[1].Length - 12))"
      } else {
        Write-Host "  WARN: could not capture $app digest - rollback file may be stale" -ForegroundColor Yellow
      }
    }
  }

  if ($From -le 2) {
    Step 2 'build api + web'
    foreach ($app in 'api', 'web') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      Ok "kaniko $app job submitted — waiting up to 25 min"
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
          $jp = 'jsonpath={range .items[*]}{.status.containerStatuses[0].imageID}{"\n"}{end}'
          $ids = K get pods -l "app=nouvellesdupays-$app" --field-selector=status.phase=Running -o $jp
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
    # New endpoint: /api/youtube/channels must return a JSON array with at least one channel
    $r = Get-Page "$site/api/youtube/channels"
    if ($r.code -ne 200) { throw "/api/youtube/channels -> $($r.code)" }
    if ($r.body -notmatch '"youtube_channel_id"') { throw "/api/youtube/channels returned no channels (missing youtube_channel_id field)" }
    Ok "/api/youtube/channels -> 200, channels present"
    # Creator hub page
    $r2 = Get-Page "$site/youtube"
    if ($r2.code -ne 200) { throw "/youtube -> $($r2.code)" }
    Ok "/youtube -> 200"
    # Regressions
    foreach ($u in '/', '/africa', '/africa/rankings', '/source/seneweb') {
      $r3 = Get-Page "$site$u"; if ($r3.code -ne 200) { throw "$u -> $($r3.code)" }
    }
    Ok "regressions /, /africa, /africa/rankings, /source/seneweb -> 200"
  }

  if ($From -le 5) {
    Step 5 'Set-KnownGood'
    Push-Location ..\scripts
    .\Set-KnownGood.ps1 -BuildNote "Build #122: YouTube creator hub — /api/youtube/channels endpoint + /youtube page redesign"
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
