# Creates the nouvellesdupays-secrets Kubernetes Secret (Postgres password +
# assembled DATABASE_URL, plus the admin-panel credential + token-signing
# secret added for the acquisition-co-worker admin UI) without ever writing
# it to a committed file -- same pattern as tekeche-api's
# 02-create-secret.ps1: assembled in memory, piped to `kubectl apply -f -`
# via stdin only.
#
# First run generates random values and prints ADMIN_PASSWORD once -- save
# it somewhere (password manager), it is not retrievable from the cluster
# afterwards except via `kubectl get secret ... -o jsonpath` by someone who
# already has cluster access (and even then, only the scrypt HASH is
# stored, not the password itself).

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

$existingAdminHash = kubectl get secret nouvellesdupays-secrets -n nouvellesdupays -o jsonpath="{.data.ADMIN_PASSWORD_HASH}" 2>$null
if ($existingAdminHash) {
  $adminPasswordHash = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($existingAdminHash))
  $adminTokenSecret = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(
    (kubectl get secret nouvellesdupays-secrets -n nouvellesdupays -o jsonpath="{.data.ADMIN_TOKEN_SECRET}")
  ))
  Write-Host "Reusing existing admin credentials from the cluster."
} else {
  $adminPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  $adminTokenSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  # Delegates hashing to the actual adminAuth.js used by the running app --
  # never reimplement the scrypt call in PowerShell, that's exactly how a
  # hash format mismatch would sneak in silently.
  Push-Location (Join-Path $PSScriptRoot "..\..\apps\api")
  $adminPasswordHash = node -e "console.log(require('./src/adminAuth').hashPassword(process.argv[1]))" $adminPassword
  Pop-Location
  Write-Host "Generated new ADMIN_PASSWORD -- save this now, it will not be shown again:"
  Write-Host $adminPassword
}

# Optional third-party credentials (Meta Conversions API, YouTube Data API).
# Never typed into a committed file: pass them via the operator's own shell
# environment for this one run, e.g.
#   $env:META_ACCESS_TOKEN = "<token from Events Manager>"; pwsh 02-create-secret.ps1
# Otherwise any value already in the cluster secret is preserved, and a key
# that has never been set is simply omitted (the API treats it as absent).
function ExistingKey($key) {
  $v = kubectl get secret nouvellesdupays-secrets -n nouvellesdupays -o jsonpath="{.data.$key}" 2>$null
  if ($v) { return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($v)) }
  return $null
}
$optional = @{}
foreach ($key in @('META_ACCESS_TOKEN', 'META_TEST_EVENT_CODE', 'YOUTUBE_API_KEY')) {
  $fromEnv = [Environment]::GetEnvironmentVariable($key)
  $value = if ($fromEnv) { $fromEnv } else { ExistingKey $key }
  if ($value) { $optional[$key] = $value; Write-Host "$key will be set ($(if ($fromEnv) {'from environment'} else {'kept from cluster'}))." }
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
  ADMIN_PASSWORD_HASH: $(ToB64 $adminPasswordHash)
  ADMIN_TOKEN_SECRET: $(ToB64 $adminTokenSecret)
"@
foreach ($k in $optional.Keys) { $manifest += "`n  ${k}: $(ToB64 $optional[$k])" }

$manifest | & kubectl apply -f -
