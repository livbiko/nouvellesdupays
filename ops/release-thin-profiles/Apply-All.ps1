# Build #98 - editorial profiles for the eight Build #97 publishers (data only, MEDIUM): tunnel, rehearse, recovery point (DB backup
# needs the tunnel), apply.sql (one guarded transaction), Test-Build, Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
& .\Start-OkeTunnel.ps1
try {
  Start-Sleep 20
  if (-not (Get-Process ssh -ErrorAction SilentlyContinue)) {
    "ssh exited early - retrying the start once in 30s"; Start-Sleep 30
    $id = Get-Content .bastion-session-id
    Start-Process ssh -ArgumentList "-i `"$HOME\.ssh\id_rsa`" -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 16443:10.0.5.8:6443 -p 22 $id@host.bastion.uk-london-1.oci.oraclecloud.com"
  }
  # 90s: the OCI token for kubectl alone takes ~23s on this server.
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }

  "=== rehearse (ROLLBACK)"
  $r = & .\Sql.ps1 rehearse.sql
  $r | Where-Object { $_ -match '^(profile|gap|rolledback|ERROR|psql)' }
  if (@($r | Where-Object { $_ -match '^profile\|' }).Count -ne 8 -or -not ($r -match '^gap\|0 ') -or -not ($r -match '^rolledback\|0 ') -or ($r -match 'ERROR')) { throw 'rehearsal did not show 6 profiles - nothing changed' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #98 editorial profiles for the eight Build #97 publishers"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(profile|gap|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^profile\|' }).Count -ne 8 -or -not ($out -match '^gap\|0 ') -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== Test-Build"
  # Test-Build prints with Write-Host and returns $true only when every check passed.
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #98: editorial profiles for Annahar, NNA, Times Kuwait, Oman Observer, News of Bahrain, la diaria, Montevideo Portal, The Bruneian (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
