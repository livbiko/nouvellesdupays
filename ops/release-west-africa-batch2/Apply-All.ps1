# Build #121 West Africa Batch 2 (data only, MEDIUM):
# 9 publishers: NE(+2) LR(+1) GM(+1) MR(+1) TG(+1) BJ(+2) CV(+1)
# Rollback: .\Sql.ps1 reverse.sql (with tunnel up).
Set-Location $PSScriptRoot
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays', '--request-timeout=90s')

$From = 1
if ($args.Count -ge 2 -and $args[0] -eq '-From') { $From = [int]$args[1] }

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

  if ($From -le 1) {
    Write-Host "`n=== Step 1: rehearse (ROLLBACK)"
    $r = & .\Sql.ps1 rehearse.sql
    $r | Where-Object { $_ -match '^(added|rolledback|ERROR|psql)' }
    if (-not ($r -match '^added\|') -or -not ($r -match '^rolledback\|0 ') -or ($r -match 'ERROR')) {
      throw 'rehearsal failed - check output above; nothing changed'
    }
  }

  if ($From -le 2) {
    Write-Host "`n=== Step 2: recovery point"
    Push-Location ..\scripts
    .\New-RecoveryPoint.ps1 -Description 'Before: Build #121 West Africa batch 2 (9 publishers)'
    $rp = $LASTEXITCODE; Pop-Location
    if ($rp -eq 1) { throw 'New-RecoveryPoint failed' }
    if ($rp -eq 2) { Write-Host "  WARN: recovery point PARTIAL" -ForegroundColor Yellow }
  }

  if ($From -le 3) {
    Write-Host "`n=== Step 3: apply  ($(Get-Date -Format HH:mm:ss))"
    $applied = (Get-Date).ToUniversalTime()
    $out = & .\Sql.ps1 apply.sql
    $out | Where-Object { $_ -match '^(count|countries|ERROR|psql)' }
    if (-not ($out -match '^count\|9 ') -or ($out -match 'ERROR')) {
      throw 'apply.sql did not insert 9 publishers - check output'
    }
  }

  if ($From -le 4) {
    Write-Host "`n=== Step 4: waiting for first worker poll..."
    $applied = (Get-Date).ToUniversalTime().AddMinutes(-2)
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
    else { Write-Host "  Worker job: $($job.metadata.name) succeeded" }
  }

  if ($From -le 5) {
    Write-Host "`n=== Step 5: verify"
    $v = & .\Sql.ps1 verify.sql
    $v | Where-Object { $_ -match '^(publisher|feeds|profiles|coverage)\|' }
    if (-not ($v -match '^feeds\|9 feeds')) { Write-Host "  WARN: expected 9 feeds" -ForegroundColor Yellow }
    if (-not ($v -match '^profiles\|9 editorial')) { Write-Host "  WARN: expected 9 editorial profiles" -ForegroundColor Yellow }
  }

  if ($From -le 6) {
    Write-Host "`n=== Step 6: Test-Build"
    Push-Location ..\scripts; $tb = @(.\Test-Build.ps1); Pop-Location
    if ($tb[-1] -ne $true) { throw 'Test-Build failed - roll back with .\Sql.ps1 reverse.sql' }
  }

  if ($From -le 7) {
    Write-Host "`n=== Step 7: known good"
    Push-Location ..\scripts
    .\Set-KnownGood.ps1 -BuildNote 'Build #121: +9 West Africa publishers (NE LR GM MR TG BJ CV) with feeds + editorial profiles'
    Pop-Location
  }

  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch { Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red; Write-Host "  Rollback: .\Sql.ps1 reverse.sql" -ForegroundColor Yellow }
finally { & .\Stop-OkeTunnel.ps1 }
