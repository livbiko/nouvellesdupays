# Read-only: stale.sql. One tunnel, always closed. Output -> stale.txt (not committed).
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
try {
  .\Start-OkeTunnel.ps1
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  .\Sql.ps1 morning-check.sql
} catch { "FAILED: $($_.Exception.Message)" } finally { .\Stop-OkeTunnel.ps1 }

