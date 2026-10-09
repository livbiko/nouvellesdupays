$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"; $env:SUPPRESS_LABEL_WARNING = "True"
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force
$id = Get-Content "$PSScriptRoot\.bastion-session-id" -ErrorAction SilentlyContinue
if ($id) { oci bastion session delete --session-id $id --force; Remove-Item "$PSScriptRoot\.bastion-session-id"; Write-Host "Bastion session deleted." }
