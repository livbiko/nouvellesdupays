# Rehearsal: look2.sql (read-only: hijacked articles, FKs) then rehearse.sql (rolled back). One tunnel, always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl --context tunnel-context -n nouvellesdupays --request-timeout=90s get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  .\Sql.ps1 look3.sql | Tee-Object look3.txt
  .\Sql.ps1 rehearse.sql | Tee-Object rehearse.txt
} catch { "FAILED: $_" } finally { .\Stop-OkeTunnel.ps1 }
