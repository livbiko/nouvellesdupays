# Rehearsal (no data change): generate the mapping in the API pod (read-only, batched, 120MB heap, killed above
# 160MB RSS), build the SQL, copy the CSV to postgres-0 and run rehearse.sql (apply + reverse inside a ROLLBACK).
# Run-Release.ps1 step 4 regenerates the mapping on the new image's cut-off before the real apply.
$ErrorActionPreference = 'Stop'
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
function K { $o = & kubectl @ctx @args 2>&1 | Where-Object { "$_" -notmatch 'OCI_API_KEY|apisigningkey|increase security|removing leading' }; if ($LASTEXITCODE) { throw "kubectl $($args -join ' '): $o" }; $o }

$pod = (K get pods -o name | Where-Object { $_ -match '^pod/nouvellesdupays-api-' } | Select-Object -First 1)
$restarts0 = K get $pod -o 'jsonpath={.status.containerStatuses[0].restartCount}'
"pod $pod (restarts $restarts0)"
foreach ($f in 'categories-old.js', 'categories-new.js', 'gen-mapping.js') {
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PSScriptRoot\$f"))
  K exec $pod '--' node -e "require('fs').writeFileSync('/tmp/$f',Buffer.from('$b64','base64'))" | Out-Null
}
K exec $pod '--' node -e "require('child_process').spawn('sh',['-c','node --max-old-space-size=120 /tmp/gen-mapping.js > /tmp/gen-mapping.out 2>&1 & echo `$! > /tmp/gen-mapping.pid; wait'],{detached:true,stdio:'ignore'}).unref()" | Out-Null
$peak = 0
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep 10
  $s = K exec $pod '--' sh -c 'p=$(cat /tmp/gen-mapping.pid 2>/dev/null); grep VmRSS /proc/$p/status 2>/dev/null; tail -c 200 /tmp/gen-mapping.out 2>/dev/null'
  if ("$s" -match 'VmRSS:\s+(\d+)') {
    $mb = [int]$Matches[1] / 1024; if ($mb -gt $peak) { $peak = $mb }
    if ($mb -gt 160) { K exec $pod '--' sh -c 'kill $(cat /tmp/gen-mapping.pid)' | Out-Null; throw "killed gen-mapping at $([int]$mb)MB RSS" }
  }
  if ("$s" -match '__END__') { break }
}
$g = K exec $pod '--' cat /tmp/gen-mapping.out
if ("$g" -notmatch '__END__' -or "$g" -match 'ERR ') { throw "mapping failed or timed out:`n$($g -join "`n")" }
[IO.File]::WriteAllText("$PSScriptRoot\gen-mapping.txt", ($g -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$csv = K exec $pod '--' cat /tmp/category-map.csv
[IO.File]::WriteAllText("$PSScriptRoot\category-map.csv", ($csv -join "`n") + "`n", [Text.Encoding]::ASCII)
$remote = ((K exec $pod '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
$local = (Get-FileHash "$PSScriptRoot\category-map.csv" -Algorithm MD5).Hash.ToLower()
if ($remote -ne $local) { throw "CSV copy differs (pod $remote, local $local)" }
K exec $pod '--' sh -c 'rm -f /tmp/categories-old.js /tmp/categories-new.js /tmp/gen-mapping.js /tmp/gen-mapping.out /tmp/gen-mapping.pid /tmp/category-map.csv' | Out-Null
"peak RSS $([int]$peak)MB; restarts now $(K get $pod -o 'jsonpath={.status.containerStatuses[0].restartCount}')"
& "$PSScriptRoot\Build-Sql.ps1"
K cp category-map.csv postgres-0:/tmp/category-map.csv | Out-Null
$pg = ((K exec postgres-0 '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
if ($pg -ne $local) { throw "CSV in postgres-0 differs ($pg vs $local)" }
$r = & "$PSScriptRoot\Sql.ps1" rehearse.sql
[IO.File]::WriteAllText("$PSScriptRoot\rehearse.txt", ($r -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$r
