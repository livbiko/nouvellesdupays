# Build #101 Liechtensteiner Vaterland HTML crawl + profile (data only, MEDIUM): tunnel, rehearse.sql (must show every change, then ROLLBACK),
# recovery point, apply.sql (one guarded transaction), first worker poll, verify.sql, Test-Build, Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')
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
  $r | Where-Object { $_ -match '^(added|dormant|coverage|gap|rolledback|ERROR|psql)' }
  [IO.File]::WriteAllText("$PSScriptRoot\rehearse.txt", ($r -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  if (@($r | Where-Object { $_ -match '^added\|.*\|html\|30\|.*profile party_aligned' }).Count -ne 1 -or -not ($r -match '^gap\|0 ') -or
      @($r | Where-Object { $_ -match '^coverage\|.*\|0 active' }).Count -ne 0 -or -not ($r -match '^rolledback\|0 ') -or ($r -match 'ERROR')) { throw 'rehearsal did not show the expected changes - nothing changed' }

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Build #101 Liechtensteiner Vaterland HTML crawl"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $applied = (Get-Date).ToUniversalTime()
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(added|coverage|gap|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^added\|' }).Count -ne 1 -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

  "=== first poll after the change"
  $job = $null
  for ($i = 0; $i -lt 30 -and -not $job; $i++) {
    Start-Sleep 30
    $jobs = & kubectl @ctx get jobs -o json 2>$null | ConvertFrom-Json
    $job = $jobs.items | Where-Object { $_.metadata.name -like 'nouvellesdupays-worker-*' -and $_.status.succeeded -ge 1 -and
      [datetime]::Parse($_.status.startTime).ToUniversalTime() -gt $applied } | Select-Object -First 1
  }
  if (-not $job) { throw 'no worker poll finished within 15 minutes after the change' }
  $done = & kubectl @ctx logs "job/$($job.metadata.name)" 2>$null | Select-String 'Done:' | Select-Object -Last 1
  "  $($job.metadata.name): $done"

  "=== verify"
  $v = & .\Sql.ps1 verify.sql
  $v | Where-Object { $_ -match '^(feed|ok|sample)\|' }
  [IO.File]::WriteAllText("$PSScriptRoot\verified.txt", ($v -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  if ($v -match '\|[1-9]\d* undated\|') { throw 'verify: undated articles were stored - roll back with .\Sql.ps1 reverse.sql' }

  "=== Test-Build"
  # Test-Build prints with Write-Host and returns $true only when every check passed.
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  "=== known good"
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Build #101: Liechtensteiner Vaterland HTML crawl + profile for Liechtenstein (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
