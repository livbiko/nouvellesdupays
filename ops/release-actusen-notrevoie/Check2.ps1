# Read-only: look2.sql. One tunnel, always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl --context tunnel-context -n nouvellesdupays --request-timeout=90s get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  .\Sql.ps1 look2.sql | Tee-Object look2.txt
} catch { "FAILED: $_" } finally { .\Stop-OkeTunnel.ps1 }
