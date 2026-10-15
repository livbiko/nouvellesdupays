# Six Egyptian sources (data only, MEDIUM): tunnel, recovery point (DB backup needs the tunnel), apply.sql (one guarded
# transaction), first worker poll after it, verify.sql, Test-Build, Set-KnownGood. Always closes the tunnel.
# Rollback: .\Sql.ps1 reverse.sql (with the tunnel up; deleting the feeds scans articles, allow several minutes).
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

  "=== recovery point"
  Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: six Egyptian sources added (Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24)"; $rp = $LASTEXITCODE; Pop-Location
  if ($rp) { throw "New-RecoveryPoint failed ($rp)" }

  "=== apply apply.sql  ($(Get-Date -Format HH:mm:ss))"
  $applied = (Get-Date).ToUniversalTime()
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(added|egypt|ERROR|psql)' }
  if (@($out | Where-Object { $_ -match '^added\|' }).Count -ne 6 -or -not ($out -match '^egypt\|8 active of 8$') -or ($out -match 'ERROR')) { throw 'apply.sql did not apply (transaction rolled back, nothing changed)' }

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
  Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Egypt: six sources added - Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24 (data only)"; Pop-Location
  "ALL DONE"
}
catch { "FAILED: $($_.Exception.Message)" }
finally { & .\Stop-OkeTunnel.ps1 }
