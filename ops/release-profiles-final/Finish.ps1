# Finish release 4 after the apply step lost the tunnel on its cleanup call (data verified committed via the public API).
# One tunnel: remove the leftover /tmp files, Test-Build, Set-KnownGood only if it passes. Tunnel always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$k = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl @k get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  '=== cleanup'; kubectl @k exec postgres-0 -- sh -c 'ls -la /tmp/apply-132107.* 2>&1; rm -f /tmp/apply-132107.sql /tmp/apply-132107.out /tmp/apply-132107.err; echo removed'
  '=== Test-Build'
  Push-Location ..\scripts; $tb = .\Test-Build.ps1; $tb; Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }
  '=== known good'
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Editorial profiles: the last 11 publishers, release 4 (data only)"; Pop-Location
  'ALL DONE'
} catch { "FAILED: $_" } finally { .\Stop-OkeTunnel.ps1 }
