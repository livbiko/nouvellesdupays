# Creates the nouvellesdupays-secrets Kubernetes Secret (Postgres password +
# assembled DATABASE_URL) without ever writing it to a committed file --
# same pattern as tekeche-api's 02-create-secret.ps1: assembled in memory,
# piped to `kubectl apply -f -` via stdin only.
#
# First run generates a random password and prints it once -- save it
# somewhere (password manager), it is not retrievable from the cluster
# afterwards except via `kubectl get secret ... -o jsonpath` by someone who
# already has cluster access.

$env:KUBECONFIG = "C:\Users\Administrator\.kube\config"

$existing = kubectl get secret nouvellesdupays-secrets -n nouvellesdupays -o jsonpath="{.data.POSTGRES_PASSWORD}" 2>$null
if ($existing) {
  $pgPassword = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($existing))
  Write-Host "Reusing existing POSTGRES_PASSWORD from the cluster."
} else {
  $pgPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  Write-Host "Generated new POSTGRES_PASSWORD -- save this now, it will not be shown again:"
  Write-Host $pgPassword
}

$databaseUrl = "postgres://nouvellesdupays:$pgPassword@postgres.nouvellesdupays.svc.cluster.local:5432/nouvellesdupays"

function ToB64($s) { [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($s)) }

$manifest = @"
apiVersion: v1
kind: Secret
metadata:
  name: nouvellesdupays-secrets
  namespace: nouvellesdupays
type: Opaque
data:
  POSTGRES_PASSWORD: $(ToB64 $pgPassword)
  DATABASE_URL: $(ToB64 $databaseUrl)
"@

$manifest | & kubectl apply -f -
