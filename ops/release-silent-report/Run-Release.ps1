<#
  Weekly silent-publishers report: apps/monitor/silent-report.sh + postgresql16-client in the monitor image +
  infra/k8s/17-silent-report-cronjob.yaml (branch feat/silent-report). HIGH (infrastructure): maintenance window
  approved 2026-10-18 ("approve the window"). One tunnel, always closed. Stop-on-failure; resume with -From <step>.
  Steps: 1 recovery point + save monitor digest | 2 merge branch | 3 build monitor | 4 check the image
         5 apply CronJob | 6 manual report run (sends one real email) | 7 next scheduled health monitor on the new image
         8 Test-Build + Set-KnownGood
  Rollback: kubectl delete cronjob nouvellesdupays-silent-report; kubectl set image cronjob/nouvellesdupays-monitor
            monitor=<image@digest in old-monitor-image.txt> (or revert the merge and rebuild). No data is written.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Branch = 'feat/silent-report'
$Repo = 'lhr.ocir.io/lr14abpkfrxj/nouvellesdupays-monitor'
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
    Step 1 'recovery point + save monitor digest'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: weekly silent-publishers report (monitor image + new CronJob)"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing changed" }
    $m = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^nouvellesdupays-monitor-' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if (-not $m) { throw 'no monitor pod to read the current image digest from' }
    $digest = ($m -split ' ')[1] -replace '^.*@', ''
    "$Repo@$digest" | Set-Content old-monitor-image.txt
    Ok "rollback image $Repo@...$($digest.Substring($digest.Length - 12))"
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
    Step 3 'build monitor image'
    K delete job kaniko-build-nouvellesdupays-monitor --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-monitor.yaml | Out-Null
    $r = JobDone 'kaniko-build-nouvellesdupays-monitor' 20
    if ($r -ne 'succeeded') { throw "kaniko monitor build $r - kubectl logs job/kaniko-build-nouvellesdupays-monitor" }
    Ok 'monitor image built'
    $script:builtAt = (Get-Date).ToUniversalTime()
    $script:builtAt.ToString('o') | Set-Content built-at.txt
  }

  if ($From -le 4) {
    Step 4 'check the image'
    $over = '{\"spec\":{\"imagePullSecrets\":[{\"name\":\"ocir-pull-secret\"}]}}'
    $name = "check-report-$(Get-Date -Format HHmmss)"
    $out = & kubectl --context tunnel-context -n nouvellesdupays --request-timeout=180s run $name --rm -i --restart=Never --image="${Repo}:latest" --image-pull-policy=Always --overrides=$over --command -- `
      sh -c 'test -x /silent-report.sh && test -x /monitor.sh && psql --version && kubectl version --client 2>/dev/null | head -1' 2>&1
    $out | Where-Object { $_ -match 'psql|Client' } | ForEach-Object { "  $_" }
    if ("$out" -notmatch 'psql \(PostgreSQL\)') { throw "image is missing psql or the scripts:`n$out" }
    Ok 'image has /silent-report.sh, /monitor.sh and psql'
  }

  if ($From -le 5) {
    Step 5 'apply the CronJob'
    K apply -f ..\..\infra\k8s\17-silent-report-cronjob.yaml | ForEach-Object { "  $_" }
    $sched = K get cronjob nouvellesdupays-silent-report -o 'jsonpath={.spec.schedule}'
    if ($sched -ne '0 7 * * 1') { throw "unexpected schedule '$sched'" }
    Ok "CronJob nouvellesdupays-silent-report, schedule '$sched'"
  }

  if ($From -le 6) {
    Step 6 'manual report run (sends one real email)'
    $job = "silent-report-manual-$(Get-Date -Format yyyyMMdd-HHmmss)"
    K create job $job --from=cronjob/nouvellesdupays-silent-report | Out-Null
    $r = JobDone $job 5
    $logs = & kubectl @ctx logs "job/$job" 2>&1
    $logs | Select-Object -First 3 | ForEach-Object { "  $_" }
    $logs | Where-Object { $_ -match 'report sent|query failed|Error|error' } | ForEach-Object { "  $_" }
    if ($r -ne 'succeeded' -or "$logs" -notmatch 'report sent') { throw "manual report run $r - see kubectl logs job/$job" }
    Ok "report job succeeded and the email was published ($job)"
  }

  if ($From -le 7) {
    Step 7 'next scheduled health monitor runs on the new image'
    $since = if ($script:builtAt) { $script:builtAt } else { [datetime]::Parse((Get-Content built-at.txt)).ToUniversalTime() }
    $found = $null
    for ($i = 0; $i -lt 60 -and -not $found; $i++) {   # up to 20 min: the monitor runs every 15
      $jobs = (& kubectl @ctx get jobs -o json 2>$null | ConvertFrom-Json).items |
        Where-Object { $_.metadata.ownerReferences.name -eq 'nouvellesdupays-monitor' -and ([datetime]$_.metadata.creationTimestamp).ToUniversalTime() -gt $since -and ($_.status.succeeded -ge 1 -or $_.status.failed -ge 1) }
      $found = $jobs | Select-Object -First 1
      if (-not $found) { Start-Sleep 20 }
    }
    if (-not $found) { throw 'no scheduled monitor run finished within 20 min of the build' }
    if ($found.status.succeeded -ge 1) { Ok "scheduled monitor run $($found.metadata.name) succeeded on the new image" }
    else { throw "scheduled monitor run $($found.metadata.name) FAILED on the new image - roll back: kubectl set image cronjob/nouvellesdupays-monitor monitor=$(Get-Content old-monitor-image.txt)" }
  }

  if ($From -le 8) {
    Step 8 'Test-Build + Set-KnownGood (refuses if any check fails or is skipped)'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Weekly silent-publishers report: monitor image + CronJob nouvellesdupays-silent-report (Mon 07:00 UTC, OCI alerts topic)"; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg)" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }
