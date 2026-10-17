# UDN (974): feed replaced by the one its homepage advertises (data only, HIGH per Get-ChangeRisk -> approved window).
# tunnel, recovery point (must be full: exit 0), apply.sql (one guarded transaction), wait for worker polls and count new
# articles per publisher, Test-Build (fails on skipped checks since Build #79), Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: UDN feed replaced by udn.com/news/rssfeed"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp -ne 0) { throw "New-RecoveryPoint exit $rp (PARTIAL) - nothing applied" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $applied = Get-Date
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(after|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^after\|' }).Count -ne 1 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== waiting for two worker runs (every 5 min), then counting new articles"
  Start-Sleep 660
  $since = $applied.ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss')
  Set-Content -Encoding utf8 verify.sql @"
\set ON_ERROR_STOP on
SELECT 'new|' || p.id || '|' || p.name || '|' || count(a.id) || '|' || coalesce(f.last_status, '-') || '|' || coalesce(f.consecutive_failures::text, '-')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id AND f.enabled
  LEFT JOIN articles a ON a.publisher_id = p.id AND a.fetched_at > TIMESTAMPTZ '$since+00'
 WHERE p.id IN (974) GROUP BY p.id, p.name, f.last_status, f.consecutive_failures ORDER BY p.id;
"@
  $v = & .\Sql.ps1 verify.sql
  $v | Where-Object { $_ -match '^new\|' }
  $zero = @($v | Where-Object { $_ -match '^new\|' -and ($_ -split '\|')[3] -eq '0' })
  if ($zero.Count -gt 0) { "  WARNING: $($zero.Count) publisher(s) still at 0 new articles - check before Set-KnownGood" }

  "=== Test-Build + known good (Set-KnownGood refuses if any check fails or is skipped)"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "UDN feed replaced by udn.com/news/rssfeed (old feed returns blank items; data only)"; $kg = $LASTEXITCODE; Pop-Location
  if ($kg) { throw "Set-KnownGood refused (exit $kg) - roll back with .\Sql.ps1 reverse.sql if the site is affected" }
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }

