# Build #107 profile corrections (data only): tunnel, rehearse.sql (rolled back), recovery point, apply.sql (one guarded
# transaction), Test-Build, Set-KnownGood. Always closes the tunnel. Rollback: the two rows from the recovery point's DB backup.
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
& .\Start-OkeTunnel.ps1
try {
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== rehearse (ROLLBACK)"
  $r = & .\Sql.ps1 rehearse.sql
  $r | Where-Object { $_ -match '^(profile|still|ERROR|psql)' }
  [IO.File]::WriteAllText("$PSScriptRoot\rehearse.txt", ($r -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  if (-not ($r -match '^profile\|9049\|.*\|review false\|4 sources') -or -not ($r -match '^profile\|8999\|.*\|review true\|4 sources') -or
      @($r | Where-Object { $_ -match '^still\|' }).Count -ne 2 -or ($r -match 'ERROR')) { throw 'rehearsal did not show the expected changes - nothing changed' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #107 profile corrections (Inquirer, Island Times)"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(profile|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^profile\|' }).Count -ne 2 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== Test-Build"
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - restore the two rows from the recovery point' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #107: profile corrections - Inquirer ownership (Inquirer.net = Rufino-Prieto; 2017 Ang deal was print), Island Times lawsuit outcome (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
