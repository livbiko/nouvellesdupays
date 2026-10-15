<#
  Undated feeds (feat/undated-feed-items 24eaa00). MEDIUM: worker code + 2 feed rows.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 1 save worker image + merge branch + push main | 2 build worker | 3 check the image has the change
         4 feeds.sql (573 Baltic Times -> /rss/ + parser_config, 1523 ElSalvador.com -> /sitemap.rss) - only after 3
         5 first poll after step 4 + verify.sql (no undated rows) | 6 Test-Build
  Rollback: .\Sql.ps1 feeds-reverse.sql first (so no undated rows are written by the old image), then re-tag the
            digest in old-worker-image.txt, or revert the merge and rebuild.
#>
param([int]$From = 1, [int]$To = 6)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/undated-feed-items'

function K {
  $retryable = @('cp', 'get', 'wait', 'logs', 'apply', 'delete') -contains $args[0]
  for ($try = 1; ; $try++) {
    $out = & kubectl @ctx --request-timeout=90s @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security|removing leading' }
    if ($LASTEXITCODE -eq 0) { return $out }
    $transient = "$out" -match 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout|Timeout'
    if (-not ($retryable -and $transient -and $try -lt 4)) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }
    Write-Host "  (kubectl $($args[0]) - tunnel blip, retry $try/3 in 10s)" -ForegroundColor Yellow
    Start-Sleep 10
  }
}
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function ApiPod { K get pods -o name | Where-Object { $_ -match '^pod/nouvellesdupays-api-' } | Select-Object -First 1 }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 1 -and $To -ge 1) {
    Step 1 "save worker image + merge $Branch"
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^nouvellesdupays-worker-' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if ($w) { ($w -split ' ')[1] | Set-Content old-worker-image.txt; Ok "rollback worker image: $(($w -split ' ')[1])" }
    else { Write-Host '  (no worker pod to read the image from - rollback via git revert + rebuild)' -ForegroundColor Yellow }
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { Pop-Location; throw 'git fetch failed' }
    git merge-base --is-ancestor origin/main $Branch
    if ($LASTEXITCODE) { Pop-Location; throw 'main has moved: fast-forward impossible' }
    git checkout -q main; git merge -q --ff-only origin/main; git merge -q --ff-only $Branch
    if ($LASTEXITCODE) { Pop-Location; throw 'merge failed' }
    git push -q origin main; if ($LASTEXITCODE) { Pop-Location; throw 'push failed' }
    Ok "main is now $(git log --oneline -1)"
    Pop-Location
  }

  if ($From -le 2 -and $To -ge 2) {
    Step 2 'build worker'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-worker --timeout=1200s | Out-Null
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content built-at.txt
    Ok 'worker image built'
  }

  if ($From -le 3 -and $To -ge 3) {
    Step 3 'check the image has the change'
    $img = (K get cronjob nouvellesdupays-worker -o 'jsonpath={.spec.jobTemplate.spec.template.spec.containers[0].image}')
    $over = '{\"spec\":{\"imagePullSecrets\":[{\"name\":\"ocir-pull-secret\"}]}}'  # quotes escaped: PS 5.1 strips bare ones from native args
    $name = "check-undated-$(Get-Date -Format HHmmss)"
    $out = & kubectl @ctx --request-timeout=180s run $name --rm -i --restart=Never --image=$img --image-pull-policy=Always --overrides=$over --command -- `
      sh -c 'grep -c fetch_time /app/apps/worker/src/poll.js; grep -c title_suffix /app/apps/worker/src/poll.js' 2>&1
    if (@($out | Where-Object { "$_" -match '^[1-9]\d*$' }).Count -ne 2) { throw "image $img does not contain the change:`n$out" }
    Ok "image $img contains the change"
  }

  if ($From -le 4 -and $To -ge 4) {
    Step 4 'feeds.sql'
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content applied-at.txt
    $out = & .\Sql.ps1 feeds.sql
    $out | Where-Object { $_ -match '^(after|ERROR|psql)' } | ForEach-Object { "  $_" }
    if (@($out | Where-Object { $_ -match '^after\|' }).Count -ne 2 -or ($out -match 'ERROR')) { throw 'feeds.sql did not apply (rolled back, nothing changed)' }
    Ok 'feeds updated'
  }

  if ($From -le 5 -and $To -ge 5) {
    Step 5 'first poll after the change + verify'
    $since = [datetime]::Parse((Get-Content applied-at.txt), $null, 'RoundtripKind')
    $job = $null
    for ($i = 0; $i -lt 40 -and -not $job; $i++) {
      $jobs = K get jobs -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.metadata.creationTimestamp}{'\n'}{end}" |
        Where-Object { $_ -match '^nouvellesdupays-worker-\d+ ' }
      $job = $jobs | Where-Object { [datetime]::Parse(($_ -split ' ')[1], $null, 'RoundtripKind') -gt $since } |
        ForEach-Object { ($_ -split ' ')[0] } | Select-Object -Last 1
      if (-not $job) { Start-Sleep 15 }
    }
    if (-not $job) { throw 'no worker poll started within 10 minutes after the change' }
    K wait --for=condition=complete "job/$job" --timeout=600s | Out-Null
    $plog = K logs "job/$job"
    $plog | Set-Content first-poll.log -Encoding UTF8
    $done = $plog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "poll $job did not finish cleanly:`n$(($plog | Select-Object -Last 15) -join "`n")" }
    Ok "$job : $done"
    $v = & .\Sql.ps1 verify.sql
    $v | Where-Object { $_ -match '^(feed|sample|ok)\|' } | ForEach-Object { "  $_" }
    [IO.File]::WriteAllText("$PSScriptRoot\verified.txt", ($v -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    if ($v -match '\|[1-9]\d* undated$') { throw 'undated rows were written - roll back (feeds-reverse.sql, then the worker image)' }
    Ok 'no undated rows'
  }

  if ($From -le 6 -and $To -ge 6) {
    Step 6 'Test-Build'
    # Test-Build prints with Write-Host and returns $true only when every check passed.
    Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
    if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back (feeds-reverse.sql, then the worker image)' }
    Ok 'Test-Build passed'
  }
  Write-Host "`nDONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
