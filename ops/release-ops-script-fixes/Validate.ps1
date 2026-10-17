# Validates the fixed scripts in one tunnel: New-RecoveryPoint (must exit 0 = full), Sql.ps1 read-only check, Test-Build, Set-KnownGood.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
try {
  .\Start-OkeTunnel.ps1
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== New-RecoveryPoint (fixed)"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Validation of the fixed New-RecoveryPoint (ops script fixes)"; $rp = $LASTEXITCODE; Pop-Location
  "  exit code: $rp"
  if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - stopping before Set-KnownGood" }

  "=== Sql.ps1 (fixed) read-only check"
  $out = & .\Sql.ps1 check.sql
  $out | Where-Object { $_ -match '^check\|' }
  if (@($out | Where-Object { $_ -match '^check\|' }).Count -ne 2) { throw 'Sql.ps1 check did not return both rows' }

  "=== known good (runs Test-Build first; refuses if any check is skipped)"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Ops scripts: New-RecoveryPoint retries + exit 2 on PARTIAL, Test-Build fails on skipped checks, Sql.ps1 keeps output on cleanup failure (no deploy)"; $kg = $LASTEXITCODE; Pop-Location
  if ($kg) { throw "Set-KnownGood refused (exit $kg)" }
  "ALL DONE"
} catch { "FAILED: $($_.Exception.Message)" } finally { .\Stop-OkeTunnel.ps1 }
