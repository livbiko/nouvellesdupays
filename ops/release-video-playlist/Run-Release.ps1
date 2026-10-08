<#
  Video player fix (uploads-playlist fallback) + removal of 19 resurfaced wrong Live Now rows (MEDIUM).
  If anything stops it (tunnel drop, error): fix/reconnect, then resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 backups (full DB + video_channels CSV + web image) | 4 merge | 5 delete 19 rows (one transaction)
         6 build web, roll out web | 7 Test-Build
  (No API/worker change: web type-checked locally; API test suite unaffected.)
#>
param([int]$From = 3)
# 'Continue', not 'Stop': in PS 5.1 any native stderr line becomes a terminating error under 'Stop'.
$ErrorActionPreference = 'Continue'
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/video-uploads-playlist'

# Plain function using $args (a [Parameter()] block would steal -o/-f/-l as common parameters).
# NB: a bare -- is swallowed by PowerShell when calling a function: always write it as '--'.
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function KC { $out = & kubectl --context tunnel-context @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'backups (recovery point)'
    $job = "ndp-backup-pre-video-playlist-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-db-backup | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=900s | Out-Null
    $objs = ((oci os object list --namespace lr14abpkfrxj --bucket-name nouvellesdupays-db-backups --all 2>$null | Out-String) | ConvertFrom-Json).data |
      Sort-Object { [datetime]$_.'time-created' } -Descending
    $newest = $objs | Select-Object -First 1
    $age = ((Get-Date).ToUniversalTime() - ([datetime]$newest.'time-created').ToUniversalTime()).TotalMinutes
    if ($age -gt 20 -or $newest.size -lt 100MB) { throw "no fresh full DB backup in the bucket (newest: $($newest.name), $([int]$age) min old)" }
    Ok "full DB backup $($newest.name) ($([int]($newest.size/1MB)) MB, $([int]$age) min old)"
    K exec postgres-0 '--' mkdir -p /tmp/ndp-backup | Out-Null
    K cp backup_video_channels.sql postgres-0:/tmp/ndp-backup/backup_video_channels.sql | Out-Null
    K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -f /tmp/ndp-backup/backup_video_channels.sql'
    K cp postgres-0:/tmp/ndp-backup/video_channels_pre_playlist.csv video_channels_pre_playlist.csv | Out-Null
    $vc = (Get-Content video_channels_pre_playlist.csv).Count
    if ($vc -lt 100) { throw "video_channels backup looks too small ($vc lines)" }
    Ok "video_channels backup saved here ($vc lines)"
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

  if ($From -le 5) {
    Step 5 'delete 19 resurfaced Live Now rows (one transaction)'
    K cp remove_resurfaced_live_now.sql postgres-0:/tmp/ndp-backup/remove_resurfaced_live_now.sql | Out-Null
    $dlog = K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -q -v ON_ERROR_STOP=1 -f /tmp/ndp-backup/remove_resurfaced_live_now.sql 2>&1'
    if ($dlog -match 'ERROR') { throw "delete FAILED and was rolled back (nothing applied):`n$($dlog -join "`n")" }
    $left = (($dlog | Where-Object { $_ -match '^\s*\d+\s*$' }) -join '').Trim()
    Ok "rows deleted ($left Live Now rows remain)"
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
    Step 7 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this to Claude. Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
