# Rehearsal of release 3: one short tunnel, rehearse.sql (rolled back) + read-only related.sql, tunnel always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl --context tunnel-context -n nouvellesdupays --request-timeout=90s get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  .\Sql.ps1 rehearse.sql | Tee-Object rehearse.txt
  .\Sql.ps1 related.sql | Tee-Object related.txt
} finally { .\Stop-OkeTunnel.ps1 }
