# Read-only: backup job status after release 4's partial recovery point, plus look.sql. One tunnel, always closed.
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$k = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
try {
  .\Start-OkeTunnel.ps1
  $ok = $false
  for ($i = 1; $i -le 6 -and -not $ok; $i++) { kubectl @k get pod postgres-0 *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true } else { Start-Sleep 15 } }
  if (-not $ok) { throw 'cluster not reachable' }
  '=== jobs'; kubectl @k get jobs --sort-by=.metadata.creationTimestamp 2>&1 | Select-Object -Last 8
  '=== backup pods'; kubectl @k get pods -l job-name=ndp-db-backup-manual-20261016-123335 -o wide 2>&1
  '=== backup log tail'; kubectl @k logs job/ndp-db-backup-manual-20261016-123335 --tail=25 2>&1
  '=== describe events'; kubectl @k describe job ndp-db-backup-manual-20261016-123335 2>&1 | Select-Object -Last 12
  '=== nodes'; kubectl @k top nodes 2>&1
  '=== look.sql'; .\Sql.ps1 look.sql | Tee-Object look.txt
} finally { .\Stop-OkeTunnel.ps1 }
