# Approved 2026-10-15: tunnel, recovery point (DB backup needs the tunnel), Run-Release (steps 1-5), Set-KnownGood. Closes the tunnel.
Set-Location $PSScriptRoot
& .\Start-OkeTunnel.ps1
try {
  # One retry of the SSH start only (the window exits on 'Permission denied' when the session key has not propagated yet).
  Start-Sleep 20
  if (-not (Get-Process ssh -ErrorAction SilentlyContinue)) {
    "ssh exited early - retrying the start once in 30s"; Start-Sleep 30
    $id = Get-Content .bastion-session-id
    Start-Process ssh -ArgumentList "-i `"$HOME\.ssh\id_rsa`" -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 16443:10.0.5.8:6443 -p 22 $id@host.bastion.uk-london-1.oci.oraclecloud.com"
  }
  for ($i = 0; $i -lt 6; $i++) { & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 10 }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: publishers.language 1054 en->ar, 1537 fr->en + 53-article category backfill"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }
  "=== release"
  & .\Run-Release.ps1
  if ($LASTEXITCODE) { throw 'Run-Release stopped' }
  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Publisher languages: 1054 en->ar, 1537 fr->en; 53 categories backfilled"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
