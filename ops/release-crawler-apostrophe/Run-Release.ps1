<#
  Crawler meta-tag fix (MEDIUM): quote-aware <meta> parsing in packages/shared/src/crawler.js.
  Before: content="L'Assemblee ..." -> headline "L", descriptions cut at the first apostrophe; and same-publisher
  "L"-headlines then collided in dedup, so later articles were dropped. Affects crawled (html/sitemap) sources only.
  Worker image only - no API/web/schema/data change. Existing truncated rows are only COUNTED here, not changed.
  Stop-on-failure; resume with  .\Run-Release.ps1 -From <step>
  Steps: 3 recovery point (worker image) + impact count | 4 merge | 5 build worker
         6 wait for the next scheduled poll on the new image | 7 verify | 8 Test-Build
  Rollback: previous worker digest in old-worker-image.txt (re-tag in OCIR) - or revert the commit and rebuild.
#>
param([int]$From = 3)
# 'Continue' + StrictMode Off: PS 5.1 turns native stderr into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$env:SUPPRESS_LABEL_WARNING = 'True'
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"
Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
$Branch = 'fix/crawler-meta-apostrophe'

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
# Read-only queries; relative path on purpose (kubectl cp reads "C:\..." as pod "C").
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
$ImpactSql = @"
SELECT 'total', count(*), count(*) FILTER (WHERE length(a.headline) <= 2), count(DISTINCT a.publisher_id) FILTER (WHERE length(a.headline) <= 2)
FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE f.feed_type IN ('html', 'sitemap');
SELECT 'by_publisher', p.id, p.name, count(*) FILTER (WHERE length(a.headline) <= 2), count(*), max(a.fetched_at)::date
FROM articles a JOIN feeds f ON f.id = a.feed_id JOIN publishers p ON p.id = a.publisher_id
WHERE f.feed_type IN ('html', 'sitemap') GROUP BY p.id, p.name ORDER BY 4 DESC, 5 DESC LIMIT 15;
"@

& kubectl --context tunnel-context get nodes --request-timeout=60s *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel is DOWN - reconnect, then: .\Run-Release.ps1 -From $From" -ForegroundColor Red; exit 1 }
Ok 'tunnel'

try {
  if ($From -le 3) {
    Step 3 'recovery point (worker image) + impact count (read-only)'
    $w = K get pods -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.status.containerStatuses[0].imageID}{'\n'}{end}" |
      Where-Object { $_ -match '^(nouvellesdupays-(worker|discovery)|ndp-discovery)' -and $_ -match '@sha256:' } | Select-Object -Last 1
    if ($w) { ($w -split ' ')[1] | Set-Content old-worker-image.txt; Ok 'rollback worker image saved' }
    else { Write-Host '  (no finished worker pod to read the image from - rollback via git revert + rebuild)' -ForegroundColor Yellow }
    $impact = Sql $ImpactSql
    $impact | Set-Content impact-before.txt
    Write-Host '  crawled-source articles (total | headline <= 2 chars | publishers affected), then per publisher:'
    $impact | ForEach-Object { Write-Host "    $_" }
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
    (Get-Date).ToUniversalTime().ToString('o') | Set-Content built-at.txt
    Ok 'worker image built (next scheduled poll uses it)'
  }

  if ($From -le 6) {
    Step 6 'wait for the next scheduled poll on the new image (every 5 min)'
    $builtAt = [datetime]::Parse((Get-Content built-at.txt), $null, 'RoundtripKind')
    $job = $null
    for ($i = 0; $i -lt 40 -and -not $job; $i++) {
      $jobs = K get jobs -o "jsonpath={range .items[*]}{.metadata.name}{' '}{.metadata.creationTimestamp}{'\n'}{end}" |
        Where-Object { $_ -match '^nouvellesdupays-worker-\d+ ' }
      $job = $jobs | Where-Object { [datetime]::Parse(($_ -split ' ')[1], $null, 'RoundtripKind') -gt $builtAt } |
        ForEach-Object { ($_ -split ' ')[0] } | Select-Object -First 1
      if (-not $job) { Start-Sleep 15 }
    }
    if (-not $job) { throw 'no worker poll started within 10 minutes of the build' }
    K wait --for=condition=complete "job/$job" --timeout=600s | Out-Null
    $plog = K logs "job/$job"
    $done = $plog | Where-Object { $_ -match '^Done:' }
    if (-not $done) { throw "poll $job did not finish cleanly:`n$(($plog | Select-Object -Last 15) -join "`n")" }
    Ok "$job : $done"
  }

  if ($From -le 7) {
    Step 7 'verify (read-only)'
    $builtAt = (Get-Content built-at.txt)
    $new = "$(Sql "SELECT count(*) || ' new crawled articles since the build, ' || count(*) FILTER (WHERE length(a.headline) <= 2) || ' with a 1-2 char headline' FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE f.feed_type IN ('html', 'sitemap') AND a.fetched_at > '$builtAt';")".Trim()
    if ($new -notmatch ', 0 with a 1-2 char headline$') { throw "truncated headlines still being created: $new" }
    Ok $new
    $site = 'https://nouvellesdupays.com'
    try { $c = (Invoke-WebRequest "$site/" -UseBasicParsing -TimeoutSec 30).StatusCode } catch { $c = 0 }
    if ($c -ne 200) { throw "/ returned $c" }
    Ok '/ -> 200'
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
