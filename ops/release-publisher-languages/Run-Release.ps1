<#
  Publisher-language correction (data only, no code change; categorizer = Build #65, main f75b7c3). MEDIUM.
  1054 Yemen Monitor en->ar, 1537 Le Nouvelliste fr->en (244/6748 stay en, see gen-mapping.js).
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 1 publishers.language (lang.sql, one guarded transaction)
         2 generate the mapping for those publishers' articles (API pod, read-only) + build SQL + upload CSV
         3 apply backfill (batched, paced) | 4 verify + first poll after the language change | 5 Test-Build
  Rollback: data -> reverse.sql, batched like apply (.\Sql.ps1 reverse.sql -Watch, CSV at postgres-0:/tmp/category-map.csv),
            then .\Sql.ps1 lang-reverse.sql.
#>
param([int]$From = 1, [int]$To = 5)  # -From 2 -To 2 = generate the mapping only (read-only), for the rehearsal
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')

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
  if ($From -le 1 -and $To -ge 1) {
    Step 1 'publishers.language (lang.sql)'
    $l = RunSql lang.sql
    $l | Set-Content lang-applied.txt -Encoding UTF8
    if ("$l" -match 'ERROR' -or "$l" -notmatch 'lang\|1054=ar 1537=en') { throw "lang.sql did not apply:`n$($l -join "`n")" }
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content built-at.txt   # step 4 waits for a poll started after this
    Ok "$(($l | Where-Object { $_ -match '^lang\|' }))"
  }

  if ($From -le 2 -and $To -ge 2) {
    Step 2 'generate the mapping (API pod, read-only), build SQL, upload CSV'
    $pod = ApiPod
    # kubectl cp, not an inline base64 'node -e': categories.js (24 KB) exceeds the Windows command-line limit.
    foreach ($f in 'categories.js', 'gen-mapping.js') {
      K cp $f "$($pod -replace '^pod/', ''):/tmp/$f" | Out-Null
      $sz = (K exec $pod '--' sh -c "wc -c < /tmp/$f") -as [int]
      if ($sz -ne (Get-Item $f).Length) { throw "copy of $f is $sz bytes, expected $((Get-Item $f).Length)" }
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
    # ~8 MB (316k rows): streaming it through 'kubectl exec cat' dropped the tunnel in the rehearsal, so it
    # travels gzipped (~1.3 MB) with kubectl cp, both down from the API pod and up to postgres-0.
    K exec $pod '--' sh -c 'gzip -c /tmp/category-map.csv > /tmp/category-map.csv.gz' | Out-Null
    K cp "$($pod -replace '^pod/', ''):/tmp/category-map.csv.gz" category-map.csv.gz | Out-Null
    node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync('category-map.csv',z.gunzipSync(fs.readFileSync('category-map.csv.gz')))"
    $remote = ((K exec $pod '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
    $local = (Get-FileHash "$PSScriptRoot\category-map.csv" -Algorithm MD5).Hash.ToLower()
    if ($remote -ne $local) { throw "category-map.csv copy differs (pod $remote, local $local)" }
    K exec $pod '--' sh -c 'rm -f /tmp/categories.js /tmp/gen-mapping.js /tmp/gen-mapping.out /tmp/gen-mapping.pid /tmp/category-map.csv /tmp/category-map.csv.gz' | Out-Null
    & "$PSScriptRoot\Build-Sql.ps1"
    K cp category-map.csv.gz postgres-0:/tmp/category-map.csv.gz | Out-Null
    K exec postgres-0 '--' gzip -df /tmp/category-map.csv.gz | Out-Null
    $pg = ((K exec postgres-0 '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
    if ($pg -ne $local) { throw "category-map.csv in postgres-0 differs ($pg vs $local)" }
    Ok "mapping: $(($g | Where-Object { $_ -match '^stats\|' }))"
  }

  if ($From -le 3 -and $To -ge 3) {
    Step 3 'apply backfill'
    # Batched (500-row batches with 4s pauses (WAL pacing), one committed statement each, watchdog on lock waiters). If it stops part-way, re-run
    # -From 3: only rows still at their old category are touched.
    # A batch that hits the 15s statement timeout (I/O stall) rolls back on its own: resume automatically, up to
    # 6 times. The lock-waiter watchdog and any other error stop for good.
    for ($attempt = 1; ; $attempt++) {
      $r = & "$PSScriptRoot\Sql.ps1" apply.sql -Watch
      $r | Set-Content "applied-$attempt.txt" -Encoding UTF8
      $timedOut = "$r" -match 'canceling statement due to statement timeout' -and "$r" -notmatch 'WATCHDOG'
      if (-not $timedOut -or $attempt -ge 6) { break }
      Write-Host "  batch timed out (attempt $attempt) - resuming in 60s" -ForegroundColor Yellow
      Start-Sleep 60
    }
    $r | Set-Content applied.txt -Encoding UTF8
    if ("$r" -match 'ERROR|WATCHDOG' -or "$r" -notmatch 'end\|') { throw "apply.sql stopped (re-run -From 3 once the cause is clear):`n$(($r | Where-Object { $_ -notmatch '^(UPDATE|DO)' -and $_ }) -join "`n")" }
    (Get-Date).ToUniversalTime().ToString('u') | Set-Content applied-at.txt
    $rows = ($r | Where-Object { $_ -match '^UPDATE (\d+)' } | ForEach-Object { [int]($_ -split ' ')[1] } | Measure-Object -Sum).Sum
    Ok "applied: $rows rows in $(@($r | Where-Object { $_ -match '^UPDATE' }).Count) batches | $(($r | Where-Object { $_ -match '^(start|end|state)\|' }) -join ' | ')"
  }

  if ($From -le 4 -and $To -ge 4) {
    Step 4 'verify + first poll after the language change'
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
    if (-not $job) { throw 'no worker poll started after the language change within 10 minutes' }
    K wait --for=condition=complete "job/$job" --timeout=600s | Out-Null
    $plog = K logs "job/$job"
    $plog | Set-Content first-poll.log -Encoding UTF8
    $done = $plog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "poll $job did not finish cleanly:`n$(($plog | Select-Object -Last 15) -join "`n")" }
    Ok "$job : $done"
  }

  if ($From -le 5 -and $To -ge 5) {
    Step 5 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Resume with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
