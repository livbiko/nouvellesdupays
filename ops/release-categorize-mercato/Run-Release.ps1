<#
  Categorizer: French-only whole-word "mercato" and the phrase "foot mercato" in every language are sports keywords
  (worker code, fix/categorize-mercato 1893064) and the category backfill (data). MEDIUM x2.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 1 save worker image + merge branch | 2 build worker | 3 check the image has the fix
         4 regenerate the mapping on the new image's cut-off (API pod, read-only) + build SQL + upload CSV
         5 apply backfill | 6 verify + first poll on the new image | 7 Test-Build
  Rollback: data -> reverse.sql (.\Sql.ps1 reverse.sql, CSV at postgres-0:/tmp/category-map.csv);
            worker -> re-tag the digest in old-worker-image.txt, or revert the merge and rebuild.
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/categorize-mercato'

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
function RunSql($file) { & "$PSScriptRoot\Sql.ps1" $file }
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function ApiPod { K get pods -o name | Where-Object { $_ -match '^pod/nouvellesdupays-api-' } | Select-Object -First 1 }

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
    Step 3 'check the image has the fix'
    $img = (K get cronjob nouvellesdupays-worker -o 'jsonpath={.spec.jobTemplate.spec.template.spec.containers[0].image}')
    $over = '{\"spec\":{\"imagePullSecrets\":[{\"name\":\"ocir-pull-secret\"}]}}'  # quotes escaped: PS 5.1 strips bare ones from native args
    $name = "check-categorize-$(Get-Date -Format HHmmss)"
    $out = & kubectl @ctx --request-timeout=180s run $name --rm -i --restart=Never --image=$img --image-pull-policy=Always --overrides=$over --command -- `
      sh -c 'grep -c foot.mercato /app/packages/shared/src/categories.js; grep -c feed.language /app/apps/worker/src/poll.js' 2>&1
    if (@($out | Where-Object { "$_" -match '^[1-9]\d*$' }).Count -ne 2) { throw "image $img does not contain the fixed categorizer:`n$out" }
    Ok "image $img contains the fixed categorizer"
  }

  if ($From -le 4) {
    Step 4 'regenerate the mapping (API pod, read-only), build SQL, upload CSV'
    $pod = ApiPod
    foreach ($f in 'categories-old.js', 'categories-new.js', 'gen-mapping.js') {
      $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PSScriptRoot\$f"))
      K exec $pod '--' node -e "require('fs').writeFileSync('/tmp/$f',Buffer.from('$b64','base64'))" | Out-Null
    }
    K exec $pod '--' sh -c 'rm -f /tmp/gen-mapping.out /tmp/gen-mapping.pid /tmp/category-map.csv' | Out-Null
    # API container limit is 256Mi (2026-10-13 OOM): 120MB heap, and killed above 160MB RSS.
    K exec $pod '--' node -e "require('child_process').spawn('sh',['-c','node --max-old-space-size=120 /tmp/gen-mapping.js > /tmp/gen-mapping.out 2>&1 & echo `$! > /tmp/gen-mapping.pid; wait'],{detached:true,stdio:'ignore'}).unref()" | Out-Null
    $peak = 0
    for ($i = 0; $i -lt 90; $i++) {
      Start-Sleep 20
      $g = K exec $pod '--' sh -c 'p=$(cat /tmp/gen-mapping.pid 2>/dev/null); grep VmRSS /proc/$p/status 2>/dev/null; cat /tmp/gen-mapping.out 2>/dev/null'
      if ("$g" -match 'VmRSS:\s+(\d+)') {
        $mb = [int]$Matches[1] / 1024; if ($mb -gt $peak) { $peak = $mb }
        if ($mb -gt 160) { K exec $pod '--' sh -c 'kill $(cat /tmp/gen-mapping.pid)' | Out-Null; throw "killed gen-mapping at $([int]$mb)MB RSS" }
      }
      if ("$g" -match '__END__') { $g = $g | Where-Object { $_ -notmatch '^VmRSS' }; break }
    }
    Write-Host "  gen-mapping peak RSS $([int]$peak)MB"
    if ("$g" -notmatch '__END__' -or "$g" -match '^ERR|ERR ') { throw "mapping generation failed or timed out:`n$($g -join "`n")" }
    [IO.File]::WriteAllText("$PSScriptRoot\gen-mapping.txt", ($g -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    $csv = K exec $pod '--' cat /tmp/category-map.csv
    [IO.File]::WriteAllText("$PSScriptRoot\category-map.csv", ($csv -join "`n") + "`n", [Text.Encoding]::ASCII)
    $remote = ((K exec $pod '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
    $local = (Get-FileHash "$PSScriptRoot\category-map.csv" -Algorithm MD5).Hash.ToLower()
    if ($remote -ne $local) { throw "category-map.csv copy differs (pod $remote, local $local)" }
    K exec $pod '--' sh -c 'rm -f /tmp/categories-old.js /tmp/categories-new.js /tmp/gen-mapping.js /tmp/gen-mapping.out /tmp/gen-mapping.pid /tmp/category-map.csv' | Out-Null
    & "$PSScriptRoot\Build-Sql.ps1"
    K cp category-map.csv postgres-0:/tmp/category-map.csv | Out-Null
    $pg = ((K exec postgres-0 '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
    if ($pg -ne $local) { throw "category-map.csv in postgres-0 differs ($pg vs $local)" }
    Ok "mapping: $(($g | Where-Object { $_ -match '^stats\|' }))"
  }

  if ($From -le 5) {
    Step 5 'apply backfill'
    $r = RunSql apply.sql
    $r | Set-Content applied.txt -Encoding UTF8
    if ("$r" -match 'ERROR' -or "$r" -notmatch 'COMMIT') { throw "apply.sql failed:`n$($r -join "`n")" }
    (Get-Date).ToUniversalTime().ToString('u') | Set-Content applied-at.txt
    Ok "applied: $(($r | Where-Object { $_ -match '^(UPDATE|state)' }) -join ' | ')"
  }

  if ($From -le 6) {
    Step 6 'verify + first poll on the new image'
    $v = RunSql verify.sql
    $v | Set-Content verified.txt -Encoding UTF8
    $st = $v | Where-Object { $_ -match '^state\|' }
    # state|mapped|at new|at old|deleted since: every mapped article still present must be at its new category
    if ($st -notmatch '^state\|(\d+)\|(\d+)\|0\|(\d+)' -or [int]$Matches[1] -ne [int]$Matches[2] + [int]$Matches[3]) { throw "verify: not every mapped article is at its new category: $st" }
    Ok "$st"
    $since = [datetime]::Parse((Get-Content built-at.txt), $null, 'RoundtripKind')
    $job = $null
    for ($i = 0; $i -lt 40 -and -not $job; $i++) {
      $jobs = K get jobs -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.metadata.creationTimestamp}{'\n'}{end}" |
        Where-Object { $_ -match '^nouvellesdupays-worker-\d+ ' }
      $job = $jobs | Where-Object { [datetime]::Parse(($_ -split ' ')[1], $null, 'RoundtripKind') -gt $since } |
        ForEach-Object { ($_ -split ' ')[0] } | Select-Object -Last 1
      if (-not $job) { Start-Sleep 15 }
    }
    if (-not $job) { throw 'no worker poll started on the new image within 10 minutes' }
    K wait --for=condition=complete "job/$job" --timeout=600s | Out-Null
    $plog = K logs "job/$job"
    $plog | Set-Content first-poll.log -Encoding UTF8
    $done = $plog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "poll $job did not finish cleanly:`n$(($plog | Select-Object -Last 15) -join "`n")" }
    Ok "$job : $done"
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
