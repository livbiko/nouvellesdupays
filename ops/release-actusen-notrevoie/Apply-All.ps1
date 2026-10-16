# Actusen -> actusen.sn (+ rename, 13 hijacked articles deleted, profile) and Notre Voie unavailable (data only, MEDIUM):
# tunnel, recovery point, apply.sql (one guarded transaction), public checks, Test-Build, Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up); the 13 deleted articles only come back from the recovery point's DB backup.
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
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Actusen moved to actusen.sn (13 hijacked articles deleted, profile) and Notre Voie unavailable"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  try {
    $out = & .\Sql.ps1 apply.sql
    $out | Where-Object { $_ -match '^(before|after|gap|ERROR|psql)' }
    if (-not ($out -match '^gap\|0 ') -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }
  } catch {
    # Release 4 lesson: Sql.ps1 can lose the tunnel after psql finished, discarding its output. Say so; the public check below decides.
    "  apply step error: $($_.Exception.Message) - checking the public API for the real state"
  }

  "=== public check"
  $r = Invoke-RestMethod "https://nouvellesdupays.com/api/publishers/8905/editorial-profile" -TimeoutSec 30
  $tags = @($r.classification_tags) -join ','
  "  8905  $tags  $($r.confidence)"
  if ($tags -ne 'unknown' -or $r.confidence -ne 'low') { throw 'Actusen profile missing or wrong on the public API - transaction did not commit, or roll back with .\Sql.ps1 reverse.sql' }

  "=== Test-Build"
  # Test-Build returns $true even when its k8s checks were skipped (Build #76), so confirm kubectl still answers afterwards.
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null
  if ($LASTEXITCODE) { throw 'tunnel lost during Test-Build - k8s checks were probably skipped; re-run Test-Build before Set-KnownGood' }
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Actusen moved to actusen.sn (13 hijacked articles deleted, profile added); Notre Voie unavailable (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
