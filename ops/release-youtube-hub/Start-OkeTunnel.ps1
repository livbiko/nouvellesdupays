# Opens a Bastion port-forward to the OKE API (10.0.5.8:6443) on localhost:16443.
# PID written to .ssh-tunnel-pid for health checks and cleanup.
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"; $env:SUPPRESS_LABEL_WARNING = "True"
$bastion = "ocid1.bastion.oc1.uk-london-1.amaaaaaaoz32urqafx64ejozquqrw6f56k53o3ah5qrwzwqrzjjsxxz3bvua"
$details = '{\"sessionType\":\"PORT_FORWARDING\",\"targetResourcePort\":6443,\"targetResourcePrivateIpAddress\":\"10.0.5.8\"}'
Write-Host "Creating Bastion session (takes ~1-2 min)..."
$json = oci bastion session create --bastion-id $bastion --target-resource-details $details `
  --ssh-public-key-file "$HOME\.ssh\id_rsa.pub" --session-ttl-in-seconds 10800 `
  --display-name "ndp-release-manual" --wait-for-state SUCCEEDED | Out-String
$id = ($json.Substring($json.IndexOf('{')) | ConvertFrom-Json).data.resources[0].identifier
$id | Set-Content "$PSScriptRoot\.bastion-session-id"
Write-Host "Session: $id - waiting 30s for the key to propagate..."
Start-Sleep -Seconds 30
$sshKey = "$HOME\.ssh\id_rsa"
$proc = Start-Process -FilePath "ssh" -ArgumentList "-i `"$sshKey`" -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 16443:10.0.5.8:6443 -p 22 $id@host.bastion.uk-london-1.oci.oraclecloud.com" -NoNewWindow -PassThru
Start-Sleep 10
if ($proc.HasExited) {
  Write-Host "SSH exited immediately (exit code $($proc.ExitCode)) - try again in 60s" -ForegroundColor Yellow
} else {
  $proc.Id | Set-Content "$PSScriptRoot\.ssh-tunnel-pid"
  Write-Host "SSH tunnel PID $($proc.Id) started. Port-forward: 16443->10.0.5.8:6443"
}
