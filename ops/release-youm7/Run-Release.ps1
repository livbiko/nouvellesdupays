<#
  Youm7: Arabic feed dates (worker code) + switch to RSS and activate (data). MEDIUM x2, approved 2026-10-13 ("approve both").
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 1 save worker image + merge branch | 2 build worker | 3 check the image has the parser
         4 apply data | 5 verify | 6 first Youm7 poll on the new image | 7 Test-Build
  Rollback: data -> reverse.sql (.\Sql.ps1 reverse.sql); worker -> re-tag the digest in old-worker-image.txt, or revert the merge and rebuild.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/arabic-feed-dates'

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
# Runs a SQL file once, detached inside the pod (exec output streams can hang over the tunnel), then reads the result.
function RunSql($file) {
  $tag = [IO.Path]::GetFileNameWithoutExtension($file) + '-' + (Get-Date -Format 'HHmmss')
  K cp $file "postgres-0:/tmp/$tag.sql" | Out-Null
  $local = (Get-Item $file).Length
  $remote = (K exec postgres-0 '--' sh -c "wc -c < /tmp/$tag.sql") -as [int]
  if ($remote -ne $local) { throw "copy of $file is $remote bytes, expected $local" }
  K exec postgres-0 '--' sh -c "nohup sh -c 'psql -U `$POSTGRES_USER -d `$POSTGRES_DB -At -f /tmp/$tag.sql -o /tmp/$tag.out > /tmp/$tag.err 2>&1; echo __END__ >> /tmp/$tag.err' > /dev/null 2>&1 &" | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 5
    $err = K exec postgres-0 '--' cat "/tmp/$tag.err"
    if ($err -match '__END__') { return @(K exec postgres-0 '--' cat "/tmp/$tag.out") + @($err | Where-Object { $_ -ne '__END__' }) }
  }
  throw "$file did not finish within 5 minutes (still running in the pod as /tmp/$tag.sql)"
}
function Body($file) { Get-Content $file | Where-Object { $_ -notmatch '^(BEGIN;|COMMIT;|\\set ON_ERROR_STOP on)$' } }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 1) {
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

  if ($From -le 2) {
    Step 2 'build worker'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-worker --timeout=1200s | Out-Null
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content built-at.txt
    Ok 'worker image built'
  }

  if ($From -le 3) {
    Step 3 'check the image has the parser'
    $img = (K get cronjob nouvellesdupays-worker -o 'jsonpath={.spec.jobTemplate.spec.template.spec.containers[0].image}')
    $over = '{\"spec\":{\"imagePullSecrets\":[{\"name\":\"ocir-pull-secret\"}]}}'  # quotes escaped: PS 5.1 strips bare ones from native args
    $name = "check-dates-$(Get-Date -Format HHmmss)"
    $out = & kubectl @ctx --request-timeout=180s run $name --rm -i --restart=Never --image=$img --image-pull-policy=Always --overrides=$over --command -- `
      sh -c 'grep -l parseArabicDate /app/apps/worker/src/poll.js /app/packages/shared/src/dates.js' 2>&1
    if ("$out" -notmatch 'poll\.js') { throw "image $img does not contain parseArabicDate:`n$out" }
    Ok "image $img contains parseArabicDate"
  }

  if ($From -le 4) {
    Step 4 'apply data'
    $r = RunSql apply.sql
    $r | Set-Content applied.txt -Encoding UTF8
    if ("$r" -match 'ERROR' -or "$r" -notmatch 'COMMIT') { throw "apply.sql failed:`n$($r -join "`n")" }
    Ok 'applied'
  }

  if ($From -le 5) {
    Step 5 'verify'
    $v = RunSql verify.sql
    if ("$v" -notmatch 'verify\|active\|active\|8952:html:false:\{\} \d+:rss:true:\{"time_zone": "Africa/Cairo"\}') { throw "verify failed: $v" }
    Ok "$v"
  }

  if ($From -le 6) {
    Step 6 'first Youm7 poll on the new image'
    $appliedAt = (Get-Date).ToUniversalTime().AddSeconds(-30)
    $job = $null
    for ($i = 0; $i -lt 40 -and -not $job; $i++) {
      $jobs = K get jobs -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.metadata.creationTimestamp}{'\n'}{end}" |
        Where-Object { $_ -match '^nouvellesdupays-worker-\d+ ' }
      $job = $jobs | Where-Object { [datetime]::Parse(($_ -split ' ')[1], $null, 'RoundtripKind') -gt $appliedAt } |
        ForEach-Object { ($_ -split ' ')[0] } | Select-Object -First 1
      if (-not $job) { Start-Sleep 15 }
    }
    if (-not $job) { throw 'no worker poll started within 10 minutes' }
    K wait --for=condition=complete "job/$job" --timeout=600s | Out-Null
    $plog = K logs "job/$job"
    $plog | Set-Content first-poll.log -Encoding UTF8
    $done = $plog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "poll $job did not finish cleanly:`n$(($plog | Select-Object -Last 15) -join "`n")" }
    Ok "$job : $done"
    $plog | Where-Object { $_ -match 'Youm7' } | ForEach-Object { Write-Host "    $_" }
    $a = RunSql articles.sql
    $a | Set-Content first-articles.txt -Encoding UTF8
    $a | ForEach-Object { Write-Host "    $_" }
    if ("$a" -notmatch 'arts\|[1-9]\d*\|0\|') { throw "Youm7 articles missing or undated: $a" }
    Ok 'Youm7 articles stored, all dated'
  }

  if ($From -le 7) {
    Step 7 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
