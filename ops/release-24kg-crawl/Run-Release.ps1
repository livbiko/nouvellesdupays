<#
  24.kg: crawler fix (non-Latin headlines were skipped as generic; branch fix/crawler-unicode-titles), then 24.kg moves from its frozen RSS
  feed to the html crawler (data). MEDIUM per Get-ChangeRisk; owner's standing
  "approve and apply for all". One tunnel, always closed. Stop-on-failure; resume with .\Run-Release.ps1 -From <step>
  Steps: 1 recovery point + save worker image | 2 merge branch | 3 build worker | 4 check the image has the change
         5 apply data | 6 wait for the crawl, check new headlines | 7 Test-Build + Set-KnownGood
  Rollback: data -> .\Sql.ps1 reverse.sql; worker -> re-tag the digest in old-worker-image.txt, or revert the merge and rebuild.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
$Branch = 'fix/crawler-unicode-titles'
function K { $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  if ($From -le 1) {
    Step 1 'recovery point + save worker image'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: crawler unicode titles (worker) + 24.kg switched to the html crawler"; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing changed" }
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^nouvellesdupays-worker-' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if (-not $w) { throw 'no worker pod to read the current image digest from' }
    $digest = ($w -split ' ')[1]
    $digest | Set-Content old-worker-image.txt
    Ok "rollback digest ...$($digest.Substring($digest.Length - 12))"
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
    Step 3 'build worker'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    $done = $false
    for ($i = 0; $i -lt 30 -and -not $done; $i++) {   # poll: a single long 'kubectl wait' does not survive a tunnel blip
      Start-Sleep 40
      $s = & kubectl @ctx get job kaniko-build-nouvellesdupays-worker -o 'jsonpath={.status.succeeded} {.status.failed}' 2>$null
      if ($s -match '^1') { $done = $true } elseif ($s -match '\d$') { throw 'kaniko build failed - kubectl logs job/kaniko-build-nouvellesdupays-worker' }
    }
    if (-not $done) { throw 'kaniko build did not finish within 20 min' }
    Ok 'worker image built'
  }

  if ($From -le 4) {
    Step 4 'check the image has the change'
    $img = K get cronjob nouvellesdupays-worker -o 'jsonpath={.spec.jobTemplate.spec.template.spec.containers[0].image}'
    $over = '{\"spec\":{\"imagePullSecrets\":[{\"name\":\"ocir-pull-secret\"}]}}'
    $name = "check-unicode-$(Get-Date -Format HHmmss)"
    $out = & kubectl --context tunnel-context -n nouvellesdupays --request-timeout=180s run $name --rm -i --restart=Never --image=$img --image-pull-policy=Always --overrides=$over --command -- `
      sh -c 'grep -c 'p{L}' /app/packages/shared/src/crawler.js' 2>&1
    if ("$out" -notmatch '\b[1-9]\d*\b') { throw "image $img does not contain the unicode normTitle fix:`n$out" }
    Ok "image $img contains the unicode normTitle fix"
  }

  if ($From -le 5) {
    Step 5 'apply data'
    $out = & .\Sql.ps1 apply.sql
    $out | Where-Object { $_ -match '^(after|ERROR|psql)' }
    if (@($out | Where-Object { $_ -match '^after\|' }).Count -ne 2 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }
    Ok 'applied'
  }

  if ($From -le 6) {
    Step 6 'wait for the crawl, check new headlines'
    Start-Sleep 660
    $since = (Get-Date).ToUniversalTime().AddMinutes(-25).ToString('yyyy-MM-dd HH:mm:ss')
    $q = "\set ON_ERROR_STOP on`n" +
      "SELECT 'new|' || count(*) || '|dated=' || count(published_at) || '|cyrillic=' || count(*) FILTER (WHERE headline ~ '[А-Яа-я]') FROM articles WHERE publisher_id = 1034 AND fetched_at > TIMESTAMPTZ '$since+00';`n" +
      "SELECT 'sample|' || coalesce(published_at::text, 'NULL') || '|' || left(headline, 70) FROM articles WHERE publisher_id = 1034 AND fetched_at > TIMESTAMPTZ '$since+00' ORDER BY published_at DESC NULLS LAST LIMIT 3;`n"
    Set-Content -Encoding utf8 verify.sql $q
    $v = & .\Sql.ps1 verify.sql
    $v | Where-Object { $_ -match '^(new|sample)\|' }
    $n = @($v | Where-Object { $_ -match '^new\|' })[0]
    if (-not $n -or $n -match '^new\|0\|') { Write-Host '  WARNING: no new 24.kg articles yet' -ForegroundColor Yellow }
    elseif ($n -notmatch 'dated=(\d+)\|cyrillic=[1-9]' -or ($n -split '\|')[1] -ne ($n -split 'dated=|\|cyrillic')[1]) { throw "new 24.kg articles are undated or have no Cyrillic headline ($n) - roll back the data with .\Sql.ps1 reverse.sql" }
    else { Ok 'new 24.kg articles stored, dated, with Cyrillic headlines' }
  }

  if ($From -le 7) {
    Step 7 'Test-Build + Set-KnownGood (refuses if any check fails or is skipped)'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Crawler keeps non-Latin headlines (normTitle unicode); 24.kg switched from frozen RSS to the html crawler (worker + data)"; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg)" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
}
finally { & .\Stop-OkeTunnel.ps1 }

