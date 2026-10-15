# Diagnostic only: open the tunnel with ssh stderr logged, test kubectl for up to 3 min, always close.
Set-Location $PSScriptRoot
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"; $env:SUPPRESS_LABEL_WARNING = "True"
$bastion = "ocid1.bastion.oc1.uk-london-1.amaaaaaaoz32urqafx64ejozquqrw6f56k53o3ah5qrwzwqrzjjsxxz3bvua"
$details = '{\"sessionType\":\"PORT_FORWARDING\",\"targetResourcePort\":6443,\"targetResourcePrivateIpAddress\":\"10.0.5.8\"}'
$json = oci bastion session create --bastion-id $bastion --target-resource-details $details --ssh-public-key-file "$HOME\.ssh\id_rsa.pub" --session-ttl-in-seconds 10800 --display-name "ndp-release-manual" --wait-for-state SUCCEEDED | Out-String
$id = ($json.Substring($json.IndexOf('{')) | ConvertFrom-Json).data.resources[0].identifier
$id | Set-Content .bastion-session-id
try {
  Start-Sleep 30
  $p = Start-Process ssh -PassThru -NoNewWindow -RedirectStandardError ssh-err.txt -ArgumentList "-i `"$HOME\.ssh\id_rsa`" -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new -N -L 16443:10.0.5.8:6443 -p 22 $id@host.bastion.uk-london-1.oci.oraclecloud.com"
  for ($i = 0; $i -lt 9; $i++) {
    Start-Sleep 20
    $o = & kubectl --context tunnel-context get nodes --request-timeout=90s 2>&1 | Where-Object { "$_" -notmatch 'OCI_API_KEY|apisigningkey|increase security|SUPPRESS' }
    "t+$(20*($i+1))s ssh alive=$(-not $p.HasExited) kubectl exit=$LASTEXITCODE :: $(($o | Select-Object -Last 2) -join ' / ')"
    if ($LASTEXITCODE -eq 0) { break }
  }
  "--- ssh stderr"; Get-Content ssh-err.txt -ErrorAction SilentlyContinue
}
finally { & .\Stop-OkeTunnel.ps1 }
