# Recovery point (with the current, unfixed New-RecoveryPoint) before the ops script fixes. One tunnel, always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
try {
  .\Start-OkeTunnel.ps1
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: ops script fixes (New-RecoveryPoint retries, Test-Build skipped=fail, Sql.ps1 cleanup)"; Pop-Location
} catch { "FAILED: $($_.Exception.Message)" } finally { .\Stop-OkeTunnel.ps1 }
