# Registers the daily Windows task that runs Copy-OnPremBackup.ps1 (Build #243). Needs an ELEVATED PowerShell
# (Run as administrator); a normal session gets "Access is denied". Runs as Administrator whether or not anyone is
# logged on (S4U: no stored password; the task only needs the local ssh key). 05:00 local = 05:00 UTC in winter,
# 04:00 UTC in summer, both after the 02:50 UTC nightly dump. Runs the task once at the end and shows the result.
#   .\Register-BackupCopyTask.ps1
$ErrorActionPreference = 'Stop'
$name = 'NDP-OnPrem-Backup-Copy'
$a = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\inetpub\wwwroot\nouvellesdupays\ops\scripts\Copy-OnPremBackup.ps1"'
$t = New-ScheduledTaskTrigger -Daily -At '05:00'
$p = New-ScheduledTaskPrincipal -UserId 'Administrator' -LogonType S4U -RunLevel Highest
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $name -Action $a -Trigger $t -Principal $p -Settings $s -Force `
    -Description 'Build #243: copy the newest nightly on-prem NDP DB dump from dr-rke2 to C:\ndp-backups (keeps 7).' | Out-Null
Start-ScheduledTask -TaskName $name
$i = 0
do { Start-Sleep -Seconds 3; $i++ } while ((Get-ScheduledTask -TaskName $name).State -eq 'Running' -and $i -lt 100)
Get-ScheduledTaskInfo -TaskName $name | Select-Object LastRunTime, LastTaskResult, NextRunTime | Format-List
Get-Content C:\ndp-backups\copy.log -Tail 3
