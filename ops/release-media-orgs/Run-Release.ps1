<#
  Build #109 - migration 016 (HIGH: database migration; maintenance window approved by the owner before running).
  Additive and idempotent: publishers.slug + creator_kind, social_accounts (backfilled from publishers.*_url), audience_metrics,
  source_scores.score_kind. Rehearsed twice in one transaction on production and rolled back (rehearse.txt).
  No rollout: only the api image is rebuilt so the migrate job (infra/k8s/04-migrate-job.yaml) can apply 016; running
  api/web/worker pods are not restarted. One tunnel, always closed. Stop-on-failure; resume with .\Run-Release.ps1 -From <step>
  Steps: 1 recovery point (full DB backup) | 2 merge branch | 3 build api image | 4 migrate job | 5 verify | 6 Test-Build + Set-KnownGood
  Rollback: .\Sql.ps1 reverse.sql, then revert the migration commit on main (migrate.js re-runs every file); or restore
            the recovery point's DB backup.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Branch = 'feat/media-organisations'
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

& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  if ($From -le 1) {
    Step 1 'recovery point (full DB backup)'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #109 migration 016 (media organisations and channels)"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing changed" }
    @(& .\Sql.ps1 verify.sql | Where-Object { $_ -match '^active\|' })[0] | Set-Content active-before.txt
    Ok "recovery point; $(Get-Content active-before.txt)"
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
    Step 3 'build api image (contains db/migrations/016)'
    K delete job kaniko-build-nouvellesdupays-api --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml | Out-Null
    $r = JobDone 'kaniko-build-nouvellesdupays-api' 20
    if ($r -ne 'succeeded') { throw "kaniko api build $r - kubectl logs job/kaniko-build-nouvellesdupays-api" }
    Ok 'api image built (running api pods are not restarted)'
  }

  if ($From -le 4) {
    Step 4 'migrate job'
    K delete job nouvellesdupays-migrate --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\04-migrate-job.yaml | Out-Null
    $r = JobDone 'nouvellesdupays-migrate' 10
    $mlog = & kubectl @ctx logs job/nouvellesdupays-migrate 2>&1
    $mlog | Select-Object -Last 6 | ForEach-Object { "  $_" }
    if ($r -ne 'succeeded' -or -not ($mlog -match '016_media_organisations') -or -not ($mlog -match 'Migrations complete')) {
      throw "migrate job $r / log unexpected - see kubectl logs job/nouvellesdupays-migrate; rollback: .\Sql.ps1 reverse.sql" }
    Ok 'migration 016 applied'
  }

  if ($From -le 5) {
    Step 5 'verify'
    $v = & .\Sql.ps1 verify.sql
    $v | Where-Object { $_ -match '^(slugs|social|scores|active)\|' } | ForEach-Object { "  $_" }
    [IO.File]::WriteAllText("$PSScriptRoot\verified.txt", ($v -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    $s = @($v | Where-Object { $_ -match '^slugs\|' })[0]
    if (-not ($s -match '^slugs\|(\d+) publishers\|(\d+) with slug\|(\d+) distinct') -or $Matches[1] -ne $Matches[2] -or $Matches[2] -ne $Matches[3]) {
      throw "slugs incomplete or not unique ($s)" }
    if (@($v | Where-Object { $_ -match '^social\|' }).Count -lt 5) { throw 'social_accounts backfill missing platforms' }
    $before = Get-Content active-before.txt -ErrorAction SilentlyContinue
    $after = @($v | Where-Object { $_ -match '^active\|' })[0]
    if ($before -and $before -ne $after) { throw "active publisher count changed ($before -> $after)" }
    Ok 'slugs unique and complete, social accounts backfilled, active publishers unchanged'
  }

  if ($From -le 6) {
    Step 6 'Test-Build + Set-KnownGood (refuses if any check fails or is skipped)'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #109: migration 016 - publishers.slug/creator_kind, social_accounts (backfilled), audience_metrics, source_scores.score_kind (additive)"; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg) - rollback: .\Sql.ps1 reverse.sql" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }
