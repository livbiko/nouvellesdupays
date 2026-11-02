# Runs one SQL file against the ON-PREM production database (since ~2026-10-31 readers are served by the
# on-prem RKE2 at 192.168.1.51, ns nouvellesdupays, with its own database -- see MAINTENANCE_LOG 2026-11-02).
# onprem-psql.sh (copied next to this script's run on .51) pipes the SQL into a throwaway postgres:16-alpine
# pod that reads DATABASE_URL from nouvellesdupays-secrets (the api/worker's own secret); the pod is removed after.
#   .\Sql-OnPrem.ps1 C:\path\to\file.sql
param([Parameter(Mandatory)][string]$File)
$ErrorActionPreference = 'Continue'
if (-not (Test-Path $File)) { throw "no such file: $File" }
$key = 'C:\Users\Administrator\.ssh\dr-rke2'
$hostSsh = 'ubuntu@192.168.1.51'
$ssh = @('-i', $key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
& scp @ssh -q "$PSScriptRoot\onprem-psql.sh" "${hostSsh}:onprem-psql.sh"
if ($LASTEXITCODE -ne 0) { throw 'scp of onprem-psql.sh failed' }
Write-Host "  running $(Split-Path $File -Leaf) on ON-PREM production"
Get-Content $File -Raw | & ssh @ssh $hostSsh 'bash ~/onprem-psql.sh' 2>&1 | Where-Object { "$_" -notmatch '^pod .* deleted' }
if ($LASTEXITCODE -ne 0) { throw "psql on-prem exited $LASTEXITCODE" }
