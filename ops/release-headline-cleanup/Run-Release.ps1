<#
  Headline-cleanup release, steps 3-6 in one go (step 2 tests already passed: 97/97 on 66ad2d7).
  Stops at the first failure. If the tunnel drops, reopen it and resume with:  .\Run-Release.ps1 -From <step>
  Steps: 3 = save rollback images, 4 = merge to main, 5 = build api+worker and roll out api, 6 = Test-Build
#>
param([int]$From = 3)
# 'Continue', not 'Stop': in Windows PowerShell 5.1 any stderr line from a native
# exe (e.g. the OCI CLI key warning via kubectl) becomes a terminating error under
# 'Stop'. Failures are detected via $LASTEXITCODE / explicit throws instead.
$ErrorActionPreference = 'Continue'
$env:SUPPRESS_LABEL_WARNING = 'True'
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')

function K { param([Parameter(ValueFromRemainingArguments)]$a) $out = & kubectl @ctx @a 2>&1; if ($LASTEXITCODE -ne 0) { throw "kubectl $($a -join ' ') failed:`n$out" }; $out }
function Step($n, $title) { Write-Host "`n=== Step $n - $title ===" -ForegroundColor Cyan }

# Tunnel check first, always.
& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reopen it, then re-run: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Write-Host "Tunnel OK" -ForegroundColor Green
& kubectl --context tunnel-context delete namespace ndp-ci --ignore-not-found *> $null

if ($From -le 3) {
  Step 3 'save rollback images'
  $api = K get pods -l app=nouvellesdupays-api -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
  $worker = (K get pods --sort-by=.metadata.creationTimestamp --no-headers -o "custom-columns=NAME:.metadata.name,IMAGE:.status.containerStatuses[0].imageID") |
    Where-Object { $_ -match '^nouvellesdupays-worker-' } | Select-Object -Last 1 | ForEach-Object { ($_ -split '\s+')[1] }
  if ($api -notmatch '@sha256:' -or $worker -notmatch '@sha256:') { throw "could not read current images (api='$api' worker='$worker')" }
  $api | Set-Content old-api-image.txt; $worker | Set-Content old-worker-image.txt
  Write-Host "api:    $api`nworker: $worker"
}

if ($From -le 4) {
  Step 4 'merge fix/headline-cleanup into main'
  Push-Location ..\..
  git fetch -q origin; if ($LASTEXITCODE) { throw 'git fetch failed' }
  git merge-base --is-ancestor origin/main origin/fix/headline-cleanup
  if ($LASTEXITCODE) { throw 'main has moved: fast-forward impossible - STOP and tell Claude' }
  Write-Host "Commits to merge:"; git log --oneline origin/main..origin/fix/headline-cleanup
  git checkout -q main; git merge -q --ff-only origin/main; git merge --ff-only origin/fix/headline-cleanup
  if ($LASTEXITCODE) { throw 'merge failed' }
  git push -q origin main; if ($LASTEXITCODE) { throw 'push failed' }
  Write-Host "main is now: $(git log --oneline -1)"
  Pop-Location
}

if ($From -le 5) {
  Step 5 'build api + worker (Kaniko, ~10 min), roll out api'
  K delete job kaniko-build-nouvellesdupays-api kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
  K apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml
  K wait --for=condition=complete job/kaniko-build-nouvellesdupays-api job/kaniko-build-nouvellesdupays-worker --timeout=1200s
  K rollout restart deployment/nouvellesdupays-api
  K rollout status deployment/nouvellesdupays-api --timeout=300s
  $new = K get pods -l app=nouvellesdupays-api -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
  Write-Host "new api image: $new"
  if ($new -eq (Get-Content old-api-image.txt)) { throw 'api image did not change - new build not picked up' }
}

if ($From -le 6) {
  Step 6 'Test-Build'
  Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
}
Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
