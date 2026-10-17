# Rehearsal: rehearse.sql (apply.sql's statements, then ROLLBACK -- nothing changes). One tunnel, always closed. Output -> rehearse.txt.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
try {
  .\Start-OkeTunnel.ps1
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  .\Sql.ps1 rehearse.sql | Tee-Object rehearse.txt
} catch { "FAILED: $($_.Exception.Message)" } finally { .\Stop-OkeTunnel.ps1 }
