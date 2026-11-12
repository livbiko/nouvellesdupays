# Copies the newest nightly on-prem DB dump (CronJob nouvellesdupays-onprem-db-backup, Build #243) from dr-rke2 to
# this server, so a lost dr-rke2 disk does not take every backup with it. Checks the SHA-256 on both ends before
# keeping the copy, keeps the newest $Keep copies, and appends one line per run to $Dest\copy.log.
# Runs daily from the scheduled task NDP-OnPrem-Backup-Copy (05:00 local, after the 02:50 UTC dump).
#   .\Copy-OnPremBackup.ps1 [-Dest C:\ndp-backups] [-Keep 7]
param([string]$Dest = 'C:\ndp-backups', [int]$Keep = 7)
$ErrorActionPreference = 'Stop'
$ssh = @('-i', 'C:\Users\Administrator\.ssh\dr-rke2', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
         '-o', 'UserKnownHostsFile=C:\Users\Administrator\.ssh\known_hosts')
$node = 'ubuntu@192.168.1.51'
$remoteDir = '/home/ubuntu/ndp-backups/daily'
New-Item -ItemType Directory -Force $Dest | Out-Null
$log = Join-Path $Dest 'copy.log'
function Write-Log([string]$msg) {
    $line = "$((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'))Z $msg"
    Add-Content -Path $log -Value $line -Encoding utf8
    Write-Host $line
}

try {
    $latest = (& ssh @ssh $node "ls -1 $remoteDir/ndp-daily-*.dump 2>/dev/null | sort | tail -1")
    if ($LASTEXITCODE -ne 0) { throw "ssh to dr-rke2 failed (exit $LASTEXITCODE)" }
    $latest = "$latest".Trim()
    if (-not $latest) { throw "no nightly dump in $remoteDir" }
    $name = Split-Path $latest -Leaf
    # A dump older than yesterday means the nightly job has stopped: copy it anyway, but fail the run.
    $day = [datetime]::ParseExact(($name -replace '^ndp-daily-|\.dump$', ''), 'yyyy-MM-dd', $null)
    $stale = $day -lt (Get-Date).ToUniversalTime().Date.AddDays(-1)

    $remoteHash = ("$(& ssh @ssh $node "sha256sum '$latest'")" -split '\s+')[0].ToUpper()
    if ($LASTEXITCODE -ne 0 -or $remoteHash.Length -ne 64) { throw "sha256sum on dr-rke2 failed" }
    $target = Join-Path $Dest $name
    if ((Test-Path $target) -and (Get-FileHash $target -Algorithm SHA256).Hash -eq $remoteHash) {
        Write-Log "already copied: $name"
    } else {
        $partial = "$target.partial"
        & scp @ssh -q "${node}:$latest" $partial
        if ($LASTEXITCODE -ne 0) { throw "scp failed (exit $LASTEXITCODE)" }
        $localHash = (Get-FileHash $partial -Algorithm SHA256).Hash
        if ($localHash -ne $remoteHash) { Remove-Item $partial -Force; throw "checksum mismatch for $name" }
        Move-Item $partial $target -Force
        Write-Log "copied: $name ($([math]::Round((Get-Item $target).Length / 1MB)) MB, sha256 $($localHash.Substring(0, 12)) checked)"
    }
    Get-ChildItem $Dest -Filter 'ndp-daily-*.dump' | Sort-Object Name -Descending | Select-Object -Skip $Keep |
        ForEach-Object { Remove-Item $_.FullName -Force; Write-Log "removed old copy: $($_.Name)" }
    if ($stale) { throw "newest nightly dump is $name - the nightly backup job has not produced a dump since" }
    exit 0
} catch {
    Write-Log "FAILED: $($_.Exception.Message)"
    exit 1
}
