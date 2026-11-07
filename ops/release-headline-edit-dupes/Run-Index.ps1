# Runs index.sql (or another file in this folder) on on-prem production with the 30-minute runner.
#   .\Run-Index.ps1            # index.sql
#   .\Run-Index.ps1 rollback.sql
param([string]$File = 'index.sql')
$ErrorActionPreference = 'Continue'
$key = 'C:\Users\Administrator\.ssh\dr-rke2'
$hostSsh = 'ubuntu@192.168.1.51'
$ssh = @('-i', $key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30')
& scp @ssh -q "$PSScriptRoot\onprem-psql-long.sh" "${hostSsh}:onprem-psql-long.sh"
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }
$bytes = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $File))
[Convert]::ToBase64String($bytes) | & ssh @ssh $hostSsh 'bash ~/onprem-psql-long.sh' 2>&1 | Where-Object { "$_" -notmatch '^pod .* deleted' }
if ($LASTEXITCODE -ne 0) { throw "psql exited $LASTEXITCODE" }
