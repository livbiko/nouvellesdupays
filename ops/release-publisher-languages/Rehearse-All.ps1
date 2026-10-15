# Read-only rehearsal: lang-check.sql (lang.sql inside a rolled-back transaction), the mapping (Run-Release -From 2 -To 2),
# then Rehearse.ps1 (sample of the batched apply/reverse, rolled back) and review.sql. Opens and closes its own tunnel.
Set-Location $PSScriptRoot
& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 12; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  "=== lang-check"; & .\Sql.ps1 lang-check.sql | Tee-Object lang-check.txt
  "=== mapping"; & .\Run-Release.ps1 -From 2 -To 2
  if ($LASTEXITCODE) { throw 'mapping failed' }
  Get-Content gen-mapping.txt
  "=== rehearse"; & .\Rehearse.ps1
  "=== review"
  $k = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
  & kubectl @k cp category-map.csv.gz postgres-0:/tmp/category-map.csv.gz 2>$null | Out-Null
  & kubectl @k exec postgres-0 -- gzip -df /tmp/category-map.csv.gz | Out-Null
  & .\Sql.ps1 review.sql | Tee-Object review.txt | Out-Null
  & kubectl @k exec postgres-0 -- rm -f /tmp/category-map.csv | Out-Null
  "review: $((Get-Content review.txt).Count) lines"
}
finally { & .\Stop-OkeTunnel.ps1 }
