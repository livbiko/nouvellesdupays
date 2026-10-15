# Rehearsal (no data change), after the 2026-10-14 incident: the full-set rehearsal held 316k row locks for ~30 min.
# Uploads the existing category-map.csv.gz to postgres-0 and runs rehearse.sql with the watchdog: full-mapping guards
# (read-only), then ONE short transaction over a 5,000-row sample running the same batch statements as apply.sql and
# reverse.sql, then ROLLBACK. Run-Release.ps1 step 4 regenerates the mapping on the new image's cut-off.
$ErrorActionPreference = 'Stop'
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
function K { $o = & kubectl @ctx @args 2>&1 | Where-Object { "$_" -notmatch 'OCI_API_KEY|apisigningkey|increase security|removing leading' }; if ($LASTEXITCODE) { throw "kubectl $($args -join ' '): $o" }; $o }

& "$PSScriptRoot\Build-Sql.ps1"
$local = (Get-FileHash "$PSScriptRoot\category-map.csv" -Algorithm MD5).Hash.ToLower()
K cp category-map.csv.gz postgres-0:/tmp/category-map.csv.gz | Out-Null
K exec postgres-0 '--' gzip -df /tmp/category-map.csv.gz | Out-Null
$pg = ((K exec postgres-0 '--' md5sum /tmp/category-map.csv) -split '\s+')[0]
if ($pg -ne $local) { throw "CSV in postgres-0 differs ($pg vs $local)" }
try { $r = & "$PSScriptRoot\Sql.ps1" rehearse.sql -Watch }
finally { K exec postgres-0 '--' rm -f /tmp/category-map.csv /tmp/watch.sh | Out-Null }
[IO.File]::WriteAllText("$PSScriptRoot\rehearse.txt", ($r -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$r | Where-Object { $_ -notmatch '^(DO|SET|RESET|BEGIN|CREATE|ANALYZE|SELECT \d+)$' -and $_ }
