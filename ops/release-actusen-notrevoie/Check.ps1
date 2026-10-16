# Read-only: full Test-Build for Build #76 (k8s checks were skipped earlier), then look.sql. One tunnel, always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$k = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl @k get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  '=== Test-Build'
  Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  '=== look.sql'; .\Sql.ps1 look.sql | Tee-Object look.txt
} catch { "FAILED: $_" } finally { .\Stop-OkeTunnel.ps1 }
