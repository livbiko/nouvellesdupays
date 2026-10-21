# Build #119 Africanews (data only, MEDIUM): rehearse, recovery point, apply, first poll, verify, Test-Build, Set-KnownGood.
# Rollback: .\Sql.ps1 reverse.sql (with tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')

& .\Start-OkeTunnel.ps1
try {
  Write-Host 'Waiting 60s for SSH tunnel...'
  Start-Sleep 60
  $sshPid = Get-Content "$PSScriptRoot\.ssh-tunnel-pid" -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 16; $i++) {
    & kubectl --context tunnel-context get nodes --request-timeout=90s *> $null
    if ($LASTEXITCODE -eq 0) { break }
    $p = if ($sshPid) { Get-Process -Id ([int]$sshPid) -ErrorAction SilentlyContinue } else { $true }
    if (!$p) { throw 'SSH tunnel died' }
    Start-Sleep 15
  }
  if ($LASTEXITCODE) { throw 'tunnel did not come up' }
  Write-Host 'Tunnel up'

  Write-Host "`n=== rehearse (ROLLBACK)"
  $r = & .\Sql.ps1 rehearse.sql
  $r | Where-Object { $_ -match '^(added|coverage|rolledback|ERROR|psql)' }
  if (-not ($r -match '^added\|') -or -not ($r -match '^rolledback\|0 ') -or ($r -match 'ERROR')) {
    throw 'rehearsal failed - check output above; nothing changed'
  }

  Write-Host "`n=== recovery point"
  Push-Location ..\scripts
  .\New-RecoveryPoint.ps1 -Description 'Before: Build #119 Africanews publisher'
  $rp = $LASTEXITCODE; Pop-Location
  if ($rp -eq 1) { throw 'New-RecoveryPoint failed' }
  if ($rp -eq 2) { Write-Host "  WARN: recovery point PARTIAL" -ForegroundColor Yellow }

  Write-Host "`n=== apply  ($(Get-Date -Format HH:mm:ss))"
  $applied = (Get-Date).ToUniversalTime()
  $out = & .\Sql.ps1 apply.sql
  $out | Where-Object { $_ -match '^(added|coverage|ERROR|psql)' }
  if (-not ($out -match '^added\|') -or ($out -match 'ERROR')) {
    throw 'apply.sql did not commit - nothing changed'
  }

  Write-Host "`n=== waiting for first worker poll..."
  $job = $null
  for ($i = 0; $i -lt 30 -and -not $job; $i++) {
    Start-Sleep 30
    $jobs = & kubectl @ctx get jobs -o json 2>$null | ConvertFrom-Json
    $job = $jobs.items | Where-Object {
      $_.metadata.name -like 'nouvellesdupays-worker-*' -and $_.status.succeeded -ge 1 -and
      [datetime]::Parse($_.status.startTime).ToUniversalTime() -gt $applied
    } | Select-Object -First 1
  }
  if (-not $job) { Write-Host "  WARN: no worker poll finished within 15 min - check manually" -ForegroundColor Yellow }
  else {
    $done = & kubectl @ctx logs "job/$($job.metadata.name)" 2>$null | Select-String 'Done:|Africanews' | Select-Object -Last 3
    Write-Host "  $($job.metadata.name): $done"
  }

  Write-Host "`n=== verify"
  $v = & .\Sql.ps1 verify.sql
  $v | Where-Object { $_ -match '^(publisher|feed|articles|profile|social)\|' }
  if (-not ($v -match '^publisher\|.*\|active\|')) { throw 'verify: publisher not active' }
  if (-not ($v -match '^profile\|')) { throw 'verify: editorial profile missing' }

  Write-Host "`n=== Test-Build"
  Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
  if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }

  Write-Host "`n=== known good"
  Push-Location ..\scripts
  .\Set-KnownGood.ps1 -BuildNote 'Build #119: +Africanews (CG, TV, en) publisher + feed + editorial profile'
  Pop-Location
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch { Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red; Write-Host "  Rollback: .\Sql.ps1 reverse.sql" -ForegroundColor Yellow }
finally { & .\Stop-OkeTunnel.ps1 }
