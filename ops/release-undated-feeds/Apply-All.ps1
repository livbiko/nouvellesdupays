# Undated feeds (data only, MEDIUM): parser_config undated=fetch_time on 5 feeds + batched 14-day published_at backfill.
# tunnel, recovery point (must be full), apply.sql (A: one guarded transaction; B: autocommit batches of 500 + 4 s pause,
# lock-waiter stop), public check (each publisher appears in its country's latest articles), Test-Build + Set-KnownGood.
# Always closes the tunnel. Rollback: .\Sql.ps1 reverse.sql (with the tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: undated feeds - fetch_time on 5 feeds + 14-day backfill"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing applied" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(undated|config|batches|start|end|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^config\|.*fetch_time' }).Count -ne 5 -or -not ($out -match '^end\|') -or ($out -match 'ERROR')) {
    throw 'apply.sql did not complete - check the output; part A is all-or-nothing, part B batches already committed stay (re-running B is safe)' }

  "=== public check: each publisher in its country's latest 100 articles"
  $bad = 0
  foreach ($c in @(@('KR', 'hani.co.kr'), @('FR', 'leparisien.fr'), @('IR', 'presstv.ir'), @('NP', 'kathmandupost.com'), @('DZ', 'elkhabar.com'))) {
    $resp = Invoke-WebRequest "https://nouvellesdupays.com/api/countries/$($c[0])/articles?limit=100" -UseBasicParsing -TimeoutSec 30
    $n = ([regex]::Matches($resp.Content, [regex]::Escape($c[1]))).Count
    "  $($c[0])  $($c[1])  $n link(s) in the latest 100"
    if ($n -eq 0) { $bad++ }
  }
  if ($bad) { "  WARNING: $bad publisher(s) not in their country's latest 100 - check before relying on this" }

  "=== Test-Build + known good (Set-KnownGood refuses if any check fails or is skipped)"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Undated feeds: fetch_time for Hankyoreh, Le Parisien, Press TV, Kathmandu Post, El Khabar + 14-day published_at backfill (data only)"; $kg = $LASTEXITCODE; Pop-Location
  if ($kg) { throw "Set-KnownGood refused (exit $kg) - roll back with .\Sql.ps1 reverse.sql if the site is affected" }
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
