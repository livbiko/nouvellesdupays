<#
  Admin login on ON-PREM production (HIGH: authentication). Since ~2026-10-31 readers are served by the on-prem
  cluster, whose API never had ADMIN_PASSWORD_HASH / ADMIN_TOKEN_SECRET: /api/admin/login -> 503 "Admin login
  not configured", so nobody could log in (owner had also lost the old password, which only exists as a hash on OKE).
  Before this runs, the OWNER sets a new password with ops/scripts/Set-AdminPassword-OnPrem.ps1 (writes the hash and
  a random token secret into nouvellesdupays-secrets; the password is never shown or stored).
  Steps: 1 recovery point | 2 both keys present (names only) | 3 wire them into the api deployment + rollout
         4 verify: wrong password -> 401 (was 503), login page 200 | 5 Test-Build + Set-KnownGood
  Rollback: kubectl -n nouvellesdupays set env deployment/nouvellesdupays-api ADMIN_PASSWORD_HASH- ADMIN_TOKEN_SECRET-
            (back to 503 "not configured"; the secret keys can stay).
  Resume: .\Run-Release.ps1 -From <step>
#>
param([int]$From = 1)
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$sshArgs = @('-i', 'C:\Users\Administrator\.ssh\dr-rke2', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
$K = 'sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays'
function Remote([string]$cmd) { $out = & ssh @sshArgs ubuntu@192.168.1.51 $cmd 2>&1; if ($LASTEXITCODE -ne 0) { throw "remote failed: $cmd`n$($out -join "`n")" }; $out }
function Step($n, $t) { Write-Host "`n=== Step $n - $t  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function LoginStatus([string]$password) {
  try { $r = Invoke-WebRequest 'https://nouvellesdupays.com/api/admin/login' -Method Post -ContentType 'application/json' -Body (@{ password = $password } | ConvertTo-Json) -UseBasicParsing -TimeoutSec 30; return [int]$r.StatusCode }
  catch { try { return [int]$_.Exception.Response.StatusCode } catch { return 0 } }
}

try {
  if ($From -le 1) {
    Step 1 'recovery point (on-prem)'
    Push-Location ..\scripts; .\New-RecoveryPoint.ps1 -Description 'Before: admin login on on-prem production'; $rp = $LASTEXITCODE; Pop-Location
    if ($rp -ne 0) { throw "recovery point exit $rp - nothing changed" }
    $before = LoginStatus 'not-the-password-probe'
    if ($before -ne 503) { Write-Host "  note: login answered $before before the change (expected 503)" -ForegroundColor Yellow } else { Ok 'login answers 503 "not configured" before the change' }
  }

  if ($From -le 2) {
    Step 2 'both keys present in nouvellesdupays-secrets (names only)'
    # describe prints "KEY:  N bytes" -- names and sizes only, never values (and no double quotes to lose on the way)
    $names = Remote "$K describe secret nouvellesdupays-secrets | grep ' bytes' | cut -d: -f1"
    # $key, not $k: PowerShell names are case-insensitive and $k overwrote $K (the kubectl command) on 11-02
    foreach ($key in 'ADMIN_PASSWORD_HASH', 'ADMIN_TOKEN_SECRET') { if ($names -notcontains $key) { throw "$key missing - run ops/scripts/Set-AdminPassword-OnPrem.ps1 first (nothing changed)" } }
    Ok 'ADMIN_PASSWORD_HASH and ADMIN_TOKEN_SECRET present'
  }

  if ($From -le 3) {
    Step 3 'wire the keys into the api deployment, roll out'
    Remote "$K set env deployment/nouvellesdupays-api --from=secret/nouvellesdupays-secrets --keys=ADMIN_PASSWORD_HASH,ADMIN_TOKEN_SECRET" | ForEach-Object { "  $_" }
    Remote "$K rollout status deployment/nouvellesdupays-api --timeout=300s" | Select-Object -Last 1 | ForEach-Object { "  $_" }
    Ok 'api rolled out with the two keys'
  }

  if ($From -le 4) {
    Step 4 'verify'
    $code = 0
    for ($i = 0; $i -lt 12 -and $code -ne 401; $i++) { $code = LoginStatus 'not-the-password-probe'; if ($code -ne 401) { Start-Sleep 10 } }
    if ($code -ne 401) { throw "wrong password answered $code (expected 401) - roll back: see header" }
    Ok 'wrong password -> 401 Invalid password (login is configured)'
    $page = (Invoke-WebRequest 'https://nouvellesdupays.com/admin/login' -UseBasicParsing -TimeoutSec 30).StatusCode
    if ($page -ne 200) { throw "/admin/login -> $page" }
    Ok '/admin/login -> 200. Owner: log in once with the new password to confirm.'
  }

  if ($From -le 5) {
    Step 5 'Test-Build + Set-KnownGood'
    Push-Location ..\scripts; .\Set-KnownGood.ps1 -BuildNote 'Admin login enabled on on-prem production (ADMIN_PASSWORD_HASH/ADMIN_TOKEN_SECRET wired into the api)'; $kg = $LASTEXITCODE; Pop-Location
    if ($kg) { throw "Set-KnownGood refused (exit $kg)" }
  }
  Write-Host "`nALL DONE" -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Rollback: ssh dr-rke2, then kubectl -n nouvellesdupays set env deployment/nouvellesdupays-api ADMIN_PASSWORD_HASH- ADMIN_TOKEN_SECRET-" -ForegroundColor Yellow
}
