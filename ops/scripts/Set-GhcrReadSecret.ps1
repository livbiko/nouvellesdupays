<#
.SYNOPSIS
    CR-2026-11-25-03: stores a READ-ONLY GitHub token (read:packages) as the k8s Secret ghcr-read on the on-prem cluster,
    so the CronJob dr-image-mirror can copy the private ghcr.io/livbiko/nouvellesdupays-* images into the local registry.

.DESCRIPTION
    The owner runs this in their own PowerShell window. The token is typed at a hidden prompt, sent over SSH on stdin
    and never printed, logged or written to disk here. Create the token on github.com (Settings > Developer settings >
    Personal access tokens > Tokens (classic) > scope read:packages only, or a fine-grained token with Packages: read).
    Re-run to replace the token.
#>
param(
    [string]$GitHubUser = 'livbiko',
    [string]$Node = 'ubuntu@192.168.1.51',
    [string]$Key = "$HOME\.ssh\dr-rke2"
)
$ErrorActionPreference = 'Stop'

$secure = Read-Host -AsSecureString "Read-only GitHub token for $GitHubUser (read:packages)"
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ($token.Length -lt 20) { throw 'That does not look like a GitHub token.' }
    $auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${GitHubUser}:$token"))
    $json = @{ auths = @{ 'ghcr.io' = @{ auth = $auth } } } | ConvertTo-Json -Depth 4 -Compress
    $remote = 'K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"; ' +
              '$K create secret generic ghcr-read --type=kubernetes.io/dockerconfigjson --from-file=.dockerconfigjson=/dev/stdin ' +
              '--dry-run=client -o yaml | $K apply -f - && echo "Secret ghcr-read stored."'
    $json | ssh -i $Key $Node $remote
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $token = $null; $auth = $null; $json = $null
}
