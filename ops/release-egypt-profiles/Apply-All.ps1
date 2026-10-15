# Editorial profiles for the six Egyptian publishers of Build #70 (data only, MEDIUM): tunnel, recovery point (DB backup
# needs the tunnel), apply.sql (one guarded transaction), public profile check, Test-Build, Set-KnownGood. Always closes the tunnel.
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

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: editorial profiles for six Egyptian publishers (8978-8983)"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(profile|egypt|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^profile\|' }).Count -ne 6 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== public profile check"
  $expect = @{ 8978 = 'government_aligned'; 8979 = 'commercial_generalist'; 8980 = 'government_aligned'; 8981 = 'independent'; 8982 = 'government_aligned'; 8983 = 'independent' }
  $bad = 0
  foreach ($pubId in $expect.Keys | Sort-Object) {
    try {
      $r = Invoke-RestMethod "https://nouvellesdupays.com/api/publishers/$pubId/editorial-profile" -TimeoutSec 30
      $tags = @($r.classification_tags) -join ','
      $ok = $tags -match $expect[$pubId]
      "  $pubId  $tags  $($r.confidence)  $(if ($ok) { 'OK' } else { 'MISMATCH' })"
      if (-not $ok) { $bad++ }
    } catch { "  $pubId  ERROR $($_.Exception.Message)"; $bad++ }
  }
  if ($bad) { throw "$bad of 6 public profiles missing or wrong - roll back with .\Sql.ps1 reverse.sql" }

  "=== Test-Build"
  # Test-Build prints with Write-Host and returns $true only when every check passed.
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Egypt: editorial profiles for Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24 (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
