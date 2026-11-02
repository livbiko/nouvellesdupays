<#
.SYNOPSIS
    Sets a NEW admin password for https://nouvellesdupays.com/admin on ON-PREM production (owner runs it).

.DESCRIPTION
    Since ~2026-10-31 readers are served by the on-prem cluster (dr-rke2), whose API never had
    ADMIN_PASSWORD_HASH / ADMIN_TOKEN_SECRET, so /api/admin/login answered 503 "Admin login not configured".
    This script:
      1. asks for the new password twice (hidden, at least 12 characters);
      2. hashes it with the site's own hashPassword() (apps/api/src/adminAuth.js, scrypt + random salt)
         and generates a random 32-byte token secret;
      3. writes both into the on-prem secret nouvellesdupays-secrets over SSH, through stdin only.
    Nothing is printed except the kubectl result. The password itself is never stored -- only its hash.
    A new ADMIN_TOKEN_SECRET logs out every existing admin session (there are none on-prem today).
    The API reads the two keys only after Enable-AdminLogin-OnPrem.ps1 has wired them into the deployment.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\nouvellesdupays\ops\scripts\Set-AdminPassword-OnPrem.ps1
#>
$ErrorActionPreference = 'Stop'
$adminAuth = 'C:/inetpub/wwwroot/nouvellesdupays/apps/api/src/adminAuth.js'

function Read-Plain([string]$prompt) {
    $s = Read-Host -Prompt $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

$p1 = Read-Plain 'New admin password (min 12 characters)'
$p2 = Read-Plain 'Repeat it'
if ($p1 -ne $p2) { throw 'The two passwords differ - nothing changed.' }
if ($p1.Length -lt 12) { throw 'Too short (minimum 12 characters) - nothing changed.' }

# Password -> node via stdin; node prints {"ADMIN_PASSWORD_HASH":..,"ADMIN_TOKEN_SECRET":..} -> ssh via stdin.
# PowerShell prepends a byte-order mark (U+FEFF) when piping to node in this console, so node received
# BOM + password and the stored hash never matched the real one (caught by the dry test, 2026-11-02).
# node strips that BOM and the trailing newline; the regex is written as an ASCII escape on purpose -- a
# literal BOM character in this BOM-less .ps1 is read by Windows PowerShell as three ANSI characters.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
$js = "const {hashPassword}=require('$adminAuth');let s='';process.stdin.setEncoding('utf8');" +
      "process.stdin.on('data',d=>s+=d).on('end',()=>{const p=s.replace(/^\uFEFF/,'').replace(/\r?\n$/,'');" +
      "process.stdout.write(JSON.stringify({ADMIN_PASSWORD_HASH:hashPassword(p),ADMIN_TOKEN_SECRET:require('crypto').randomBytes(32).toString('hex')}))})"
$json = $p1 | node -e $js
$p1 = $null; $p2 = $null
if ($LASTEXITCODE -ne 0 -or $json -notmatch '"ADMIN_PASSWORD_HASH":"[0-9a-f]{32}:[0-9a-f]{128}"') { throw 'Hashing failed - nothing changed.' }

# The remote side is a script, not an inline command: Windows PowerShell 5.1 drops embedded double quotes
# from arguments to native programs, which would mangle a JSON patch passed on ssh's command line.
$sshArgs = @('-i', 'C:\Users\Administrator\.ssh\dr-rke2', '-o', 'BatchMode=yes')
& scp @sshArgs -q "$PSScriptRoot\onprem-set-admin-secret.sh" 'ubuntu@192.168.1.51:onprem-set-admin-secret.sh'
if ($LASTEXITCODE -ne 0) { throw 'Copying the helper to dr-rke2 failed - nothing changed.' }
$json | & ssh @sshArgs ubuntu@192.168.1.51 'bash ~/onprem-set-admin-secret.sh'
$json = $null
if ($LASTEXITCODE -ne 0) { throw 'Writing the secret failed.' }
Write-Host 'Done. Tell Claude "password set" (do not share the password).' -ForegroundColor Green
