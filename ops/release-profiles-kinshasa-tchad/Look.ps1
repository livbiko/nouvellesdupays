# Read-only: look.sql. One tunnel, always closed. Output -> look.txt (not committed).
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
$k = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl @k get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  '=== look.sql'; .\Sql.ps1 look.sql | Tee-Object look.txt
} finally { .\Stop-OkeTunnel.ps1 }
