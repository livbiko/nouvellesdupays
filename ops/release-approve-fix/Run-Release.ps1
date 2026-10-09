<#
  Approve fix (MEDIUM): approving a submission no longer merges it into an existing publisher with the same name
  (ON CONFLICT DO UPDATE overwrote the homepage - Benin Intelligent, 2026-10-09). A same name / site / feed now
  returns 409 and changes nothing. API image only; no web/schema/data change, no migration.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 recovery point (api image) | 4 merge | 5 build api | 6 roll out api | 7 verify | 8 Test-Build
  Rollback: kubectl set image deployment/nouvellesdupays-api <container>=<old-api-image.txt>
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/approve-no-merge'

# Tunnel/auth blips are retried for verbs that are safe to repeat - never for exec/create.
function K {
  $retryable = @('cp', 'get', 'wait', 'logs', 'apply', 'delete') -contains $args[0]
  for ($try = 1; ; $try++) {
    $out = & kubectl @ctx @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security' }
    if ($LASTEXITCODE -eq 0) { return $out }
    $transient = "$out" -match 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout'
    if (-not ($retryable -and $transient -and $try -lt 4)) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }
    Write-Host "  (kubectl $($args[0]) - tunnel blip, retry $try/3 in 10s)" -ForegroundColor Yellow
    Start-Sleep 10
  }
}
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
# Image of the live pods only: right after a rollout an old pod can still be listed while it terminates.
function Image($app) {
  $pods = ((K get pods -l "app=nouvellesdupays-$app" -o json) | Out-String | ConvertFrom-Json).items |
    Where-Object { -not $_.metadata.deletionTimestamp -and $_.status.phase -eq 'Running' }
  ($pods | ForEach-Object { $_.status.containerStatuses[0].imageID } | Sort-Object -Unique | Select-Object -First 1)
}
function Code($url) { try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 60).StatusCode } catch { [int]$_.Exception.Response.StatusCode } }

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'recovery point (current api image)'
    foreach ($app in 'api') {
      $img = Image $app
      if ("$img" -notmatch '@sha256:') { throw "could not read current $app image ('$img')" }
      $img | Set-Content "old-$app-image.txt"
      Ok "rollback $app image: $($img.Substring($img.Length-12))"
    }
  }

  if ($From -le 4) {
    Step 4 "merge $Branch into main"
    Push-Location ..\..
    git fetch -q origin; if ($LASTEXITCODE) { throw 'git fetch failed' }
    git merge-base --is-ancestor origin/main "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'main has moved: fast-forward impossible - STOP and tell Claude' }
    Write-Host 'Commits to merge:'; git log --oneline "origin/main..origin/$Branch"
    git checkout -q main; git merge -q --ff-only origin/main; git merge --ff-only "origin/$Branch"
    if ($LASTEXITCODE) { Pop-Location; throw 'merge failed' }
    git push -q origin main; if ($LASTEXITCODE) { Pop-Location; throw 'push failed' }
    Ok "main is now $(git log --oneline -1)"
    Pop-Location
  }

  if ($From -le 5) {
    Step 5 'build api'
    foreach ($app in 'api') {
      K delete job "kaniko-build-nouvellesdupays-$app" --ignore-not-found | Out-Null
      K apply -f "..\..\infra\k8s\ci\kaniko-build-$app.yaml" | Out-Null
      K wait --for=condition=complete "job/kaniko-build-nouvellesdupays-$app" --timeout=1200s | Out-Null
      Ok "$app image built"
    }
  }

  if ($From -le 6) {
    Step 6 'roll out api'
    foreach ($app in 'api') {
      K rollout restart "deployment/nouvellesdupays-$app" | Out-Null
      K rollout status "deployment/nouvellesdupays-$app" --timeout=300s | Out-Null
      if ((Image $app) -eq (Get-Content "old-$app-image.txt")) { throw "$app image did not change - new build not picked up" }
      Ok "$app rolled out on new image"
    }
  }

  if ($From -le 7) {
    Step 7 'verify'
    $site = 'https://nouvellesdupays.com'
    $got = try { (Invoke-WebRequest "$site/api/admin/submissions/1/approve" -Method Post -ContentType "application/json" -Body "{}" -UseBasicParsing -TimeoutSec 60).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
    if ($got -ne 401) { throw "approve endpoint without a token returned $got, expected 401" }
    Ok 'approve endpoint still requires the admin login (401)'
    foreach ($c in @(@('/', 200), @('/admin', 200))) {
      $code = Code "$site$($c[0])"
      if ($code -ne $c[1]) { throw "$($c[0]) returned $code, expected $($c[1])" }
      Ok "$($c[0]) -> $code"
    }
    # Read-only: waiting submissions the new check would refuse (for the owner's information).
    Set-Content -Path ndp-q.sql -Encoding ASCII -Value @'
SELECT s.id || ' ' || s.name || ' -> ' || p.name || ' (publisher ' || p.id || ')'
FROM publisher_submissions s JOIN publishers p
  ON (p.country_id = s.country_id AND lower(p.name) = lower(trim(s.name)))
  OR lower(regexp_replace(regexp_replace(p.domain, '^www\.', ''), '/+$', '')) = split_part(lower(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', '')), '/', 1)
WHERE s.status IN ('pending', 'submitted') ORDER BY s.id;
'@
    K cp ndp-q.sql postgres-0:/tmp/ndp-q.sql | Out-Null
    $dups = K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -At -f /tmp/ndp-q.sql 2>&1'
    if ($dups) { Write-Host '  Waiting submissions that will now be refused as duplicates:' -ForegroundColor Yellow; $dups | ForEach-Object { Write-Host "    $_" } }
    else { Ok 'no waiting submission duplicates an existing publisher by name or site' }
  }

  if ($From -le 8) {
    Step 8 'Test-Build'
    Push-Location ..\scripts; .\Test-Build.ps1; Pop-Location
  }
  Write-Host "`nDONE - tell Claude 'deployed'." -ForegroundColor Green
}
catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Paste this to Claude. Resume later with: .\Run-Release.ps1 -From <step shown above>" -ForegroundColor Yellow
  exit 1
}
