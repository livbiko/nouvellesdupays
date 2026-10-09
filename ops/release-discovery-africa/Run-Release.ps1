<#
  Discovery worker: all five African regions (HIGH - CronJob environment variable; approved maintenance window required).
  Worker image (comma-separated DISCOVERY_REGION support) + CronJob DISCOVERY_REGION = all African regions.
  No API/web/schema/data change. The worker still only writes candidates; outreach rows are never touched.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 recovery point (worker image, counts) | 4 merge | 5 build worker | 6 apply CronJob
         7 supervised run on the new image + verify | 8 Test-Build
  Rollback: re-apply the CronJob with DISCOVERY_REGION="West Africa" (the new image handles a single region as before);
            worker image: previous digest in old-worker-image.txt / git revert + rebuild. Candidates found meanwhile stay
            (harmless, reviewable).
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'feat/discovery-all-africa'
$Regions = 'West Africa,East Africa,Central Africa,North Africa,Southern Africa'

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
# Read-only queries; relative path (kubectl cp reads "C:\..." as pod "C"); no psql -F (PS 5.1 strips its quotes);
# ASCII only in this file (PS 5.1 reads BOM-less UTF-8 as ANSI).
function Sql($q) {
  Set-Content -Path ndp-q.sql -Value $q -Encoding ASCII
  for ($try = 1; ; $try++) {
    try {
      K cp ndp-q.sql postgres-0:/tmp/ndp-q.sql | Out-Null
      return K exec postgres-0 '--' sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -At -f /tmp/ndp-q.sql 2>&1'
    } catch {
      if ($try -ge 4 -or "$_" -notmatch 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout') { throw }
      Write-Host "  (query - tunnel blip, retry $try/3 in 10s)" -ForegroundColor Yellow
      Start-Sleep 10
    }
  }
}
function Step($n, $title) { Write-Host "`n=== Step $n - $title  ($(Get-Date -Format HH:mm:ss)) ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
$OutreachSql = "SELECT (SELECT count(*) FROM discovered_sources WHERE status IN ('verified','contacted','invited')) || ' outreach rows, ' || (SELECT count(*) FROM invitations WHERE status = 'sent') || ' invitations sent';"
$MinedSql = "SELECT c.region || '=' || count(*) FROM discovery_mining_log m JOIN publishers p ON p.id = m.publisher_id JOIN countries c ON c.id = p.country_id GROUP BY c.region ORDER BY 1;"

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'recovery point (worker image) + counts (read-only)'
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^(nouvellesdupays-(worker|discovery)|ndp-discovery)' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if ($w) { ($w -split ' ')[1] | Set-Content old-worker-image.txt; Ok 'rollback worker image saved' }
    else { Write-Host '  (no finished worker pod to read the image from - rollback via git revert + rebuild)' -ForegroundColor Yellow }
    $o = "$(Sql $OutreachSql)".Trim(); $o | Set-Content outreach-before.txt
    Ok "outreach: $o"
    Ok "homepages mined so far by region: $((Sql $MinedSql) -join ', ')"
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
    Step 5 'build worker'
    K delete job kaniko-build-nouvellesdupays-worker --ignore-not-found | Out-Null
    K apply -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml | Out-Null
    K wait --for=condition=complete job/kaniko-build-nouvellesdupays-worker --timeout=1200s | Out-Null
    $pushed = (K logs job/kaniko-build-nouvellesdupays-worker | Where-Object { $_ -match 'Pushed .*@(sha256:\w+)' } | Select-Object -Last 1)
    if ($pushed -match '@(sha256:\w+)') { $Matches[1] | Set-Content new-worker-digest.txt; Ok "worker image pushed $($Matches[1].Substring(0,19))..." }
    else { Ok 'worker image built' }
  }

  if ($From -le 6) {
    Step 6 'apply CronJob (all African regions)'
    K apply -f ..\..\infra\k8s\16-discovery-cronjob.yaml | Out-Null
    $reg = K get cronjob nouvellesdupays-discovery -o "jsonpath={.spec.jobTemplate.spec.template.spec.containers[0].env[?(@.name=='DISCOVERY_REGION')].value}"
    if ("$reg".Trim() -ne $Regions) { throw "DISCOVERY_REGION is '$reg', expected '$Regions'" }
    Ok "DISCOVERY_REGION = $reg"
  }

  if ($From -le 7) {
    Step 7 'supervised discovery run on the new image + verify'
    $job = "ndp-discovery-africa-$(Get-Date -Format HHmm)"
    K create job $job --from=cronjob/nouvellesdupays-discovery | Out-Null
    K wait --for=condition=complete "job/$job" --timeout=1500s | Out-Null
    $img = K get pods -l "job-name=$job" -o "jsonpath={.items[0].status.containerStatuses[0].imageID}"
    if ((Test-Path new-worker-digest.txt) -and "$img" -notmatch [regex]::Escape((Get-Content new-worker-digest.txt).Trim())) { throw "run used an old image: $img" }
    $dlog = K logs "job/$job"
    $head = $dlog | Where-Object { $_ -match '^Discovery run' } | Select-Object -First 1
    if ($head -notmatch 'Southern Africa') { throw "run did not target all regions: $head" }
    Ok $head.Trim()
    $done = $dlog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "discovery run did not finish cleanly:`n$(($dlog | Select-Object -Last 20) -join "`n")" }
    Ok "$done"
    $mined = Sql $MinedSql
    if (-not ($mined | Where-Object { $_ -notmatch '^West Africa=' })) { throw "no homepage outside West Africa was mined: $($mined -join ', ')" }
    Ok "homepages mined by region: $($mined -join ', ')"
    $o = "$(Sql $OutreachSql)".Trim()
    if ((Test-Path outreach-before.txt) -and $o -ne (Get-Content outreach-before.txt).Trim()) { throw "outreach changed: before '$(Get-Content outreach-before.txt)', now '$o'" }
    Ok "outreach unchanged: $o"
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
