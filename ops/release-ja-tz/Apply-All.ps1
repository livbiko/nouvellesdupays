# Build #108 label_time_zone Europe/Paris on Jeune Afrique (data only, MEDIUM): tunnel, rehearse.sql (rolled back), recovery point, apply.sql
# (one guarded transaction), wait ~15 min of worker polls, verify.sql, Test-Build, Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== rehearse (ROLLBACK)"
  $r = & .\Sql.ps1 rehearse.sql
  $r | Where-Object { $_ -match '^(config|rolledback|ERROR|psql)' }
  [IO.File]::WriteAllText("$PSScriptRoot\rehearse.txt", ($r -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  if (@($r | Where-Object { $_ -match '^config\|5207\|\{"label_time_zone": "Europe/Paris"\}$' }).Count -ne 1 -or
      @($r | Where-Object { $_ -match '^rolledback\|5207\|\{\}$' }).Count -ne 1 -or ($r -match 'ERROR')) { throw 'rehearsal did not show the expected changes - nothing changed' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #108 label_time_zone on Jeune Afrique"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(config|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^config\|5207\|\{"label_time_zone"' }).Count -ne 1 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== wait 15 min for worker polls"
  Start-Sleep 900

  "=== verify"
  $v = & .\Sql.ps1 verify.sql
  $v | Where-Object { $_ -match '^new\|' }
  [IO.File]::WriteAllText("$PSScriptRoot\verified.txt", ($v -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  if ($v -match '^new\|.*\|[1-9]\d* after fetch') { throw 'verify: rows dated after their fetch time - roll back with .\Sql.ps1 reverse.sql' }
  $stuck = @($v | Where-Object { $_ -match '^new\|\d+\|(\d+) new\|(\d+) at fetch time' -and $Matches[1] -eq $Matches[2] -and [int]$Matches[1] -ge 3 })
  if ($stuck.Count) { throw "verify: still clamped to fetch time: $($stuck -join '; ') - roll back with .\Sql.ps1 reverse.sql" }

  "=== Test-Build"
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #108: label_time_zone Europe/Paris on Jeune Afrique (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
