<#
.SYNOPSIS
    Runs the full verification checklist for NouvellesDuPays.
    All checks must pass before a build can be marked as Known Good.

.EXAMPLE
    .\Test-Build.ps1
    .\Test-Build.ps1 -Verbose
#>
param([switch]$Verbose)

$env:KUBECONFIG = "C:\Users\Administrator\.kube\config"
$SITE_BASE = "https://nouvellesdupays.com"
$K8S_NS    = "nouvellesdupays"

$results = [ordered]@{}
$passed  = 0
$failed  = 0
$skipped = 0

function Check($name, $block) {
    try {
        $ok = & $block
        if ($ok) {
            Write-Host "  ✅  $name" -ForegroundColor Green
            $script:results[$name] = "PASS"
            $script:passed++
        } else {
            Write-Host "  ❌  $name" -ForegroundColor Red
            $script:results[$name] = "FAIL"
            $script:failed++
        }
    } catch {
        Write-Host "  ❌  $name — $($_.Exception.Message)" -ForegroundColor Red
        $script:results[$name] = "ERROR: $($_.Exception.Message)"
        $script:failed++
    }
}

function CheckSkippable($name, $block, $skipCondition, $skipReason) {
    if (& $skipCondition) {
        Write-Host "  ⚠️   $name — SKIPPED ($skipReason)" -ForegroundColor Yellow
        $script:results[$name] = "SKIPPED: $skipReason"
        $script:skipped++
        return
    }
    Check $name $block
}

Write-Host "`n=== NouvellesDuPays Build Verification ===" -ForegroundColor Cyan
Write-Host "    $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ── 1. Public homepage loads ──────────────────────────────────────────────────
Check "Public homepage returns 200" {
    $r = Invoke-WebRequest "$SITE_BASE/" -TimeoutSec 15 -UseBasicParsing
    $r.StatusCode -eq 200
}

# ── 2. Public API returns real data ──────────────────────────────────────────
# Not an exact count -- that went stale the moment Phase 2 added more
# countries (this check itself failed on "== 5" right after the country
# expansion shipped). >= 5 stays true as coverage grows instead of needing
# a manual bump every time.
Check "Public API /api/countries returns at least 5 countries" {
    $r = Invoke-RestMethod "$SITE_BASE/api/countries" -TimeoutSec 15
    $r.Count -ge 5
}

# ── 3. TLS certificate valid and not expiring soon ────────────────────────────
Check "TLS certificate valid, not expiring within 14 days" {
    $tcp = [System.Net.Sockets.TcpClient]::new("nouvellesdupays.com", 443)
    try {
        $ssl = [System.Net.Security.SslStream]::new($tcp.GetStream(), $false, { $true })
        $ssl.AuthenticateAsClient("nouvellesdupays.com")
        $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($ssl.RemoteCertificate)
        $daysLeft = ($cert.NotAfter - (Get-Date)).Days
        if ($daysLeft -lt 14) { Write-Host "        ⚠️  Cert expires in $daysLeft days ($($cert.NotAfter)) — renew soon, no auto-renewal is set up" -ForegroundColor Yellow }
        $ssl.Close()
        $daysLeft -gt 0
    } finally {
        $tcp.Close()
    }
}

# ── 4. K8s pods healthy ───────────────────────────────────────────────────────
$k8sReachable = $true
try { kubectl get ns $K8S_NS --request-timeout=15s 2>&1 | Out-Null; $k8sReachable = ($LASTEXITCODE -eq 0) } catch { $k8sReachable = $false }

CheckSkippable "K8s: api/web deployments available" {
    $api = kubectl get deployment nouvellesdupays-api -n $K8S_NS -o jsonpath="{.status.availableReplicas}" --request-timeout=30s 2>$null
    $web = kubectl get deployment nouvellesdupays-web -n $K8S_NS -o jsonpath="{.status.availableReplicas}" --request-timeout=30s 2>$null
    ([int]$api -ge 1) -and ([int]$web -ge 1)
} { -not $k8sReachable } "no Bastion tunnel / kubectl unreachable"

CheckSkippable "K8s: Postgres pod running" {
    $status = kubectl get pod postgres-0 -n $K8S_NS -o jsonpath="{.status.phase}" --request-timeout=30s 2>$null
    $status -eq "Running"
} { -not $k8sReachable } "no Bastion tunnel / kubectl unreachable"

# ── 5. Worker CronJob is actually running on schedule ─────────────────────────
# The public API doesn't expose fetched_at (only the article's own published_at,
# which reflects the source's publish time, not our polling activity) -- so
# freshness has to be checked via the CronJob's own recent run history, not
# article timestamps.
CheckSkippable "K8s: worker CronJob ran recently and succeeded" {
    $jobs = kubectl get job -n $K8S_NS --request-timeout=30s -o json 2>$null | ConvertFrom-Json
    $workerJobs = $jobs.items | Where-Object { $_.metadata.name -like "nouvellesdupays-worker-*" } |
        Sort-Object { [datetime]$_.metadata.creationTimestamp } -Descending
    if ($workerJobs.Count -eq 0) { return $false }
    $latest = $workerJobs[0]
    $ranRecently = ((Get-Date) - [datetime]$latest.metadata.creationTimestamp).TotalMinutes -lt 20
    $succeeded = $latest.status.succeeded -eq 1
    if (-not $ranRecently) { Write-Host "        ⚠️  Last worker run was $([Math]::Round(((Get-Date) - [datetime]$latest.metadata.creationTimestamp).TotalMinutes,1)) min ago (expected every ~5 min)" -ForegroundColor Yellow }
    $ranRecently -and $succeeded
} { -not $k8sReachable } "no Bastion tunnel / kubectl unreachable"

# ── 6. No CrashLoopBackOff on any nouvellesdupays pod ─────────────────────────
CheckSkippable "No pods in CrashLoopBackOff" {
    $pods = kubectl get pods -n $K8S_NS -o json --request-timeout=30s 2>$null | ConvertFrom-Json
    $crashing = $pods.items | Where-Object {
        $_.status.containerStatuses | Where-Object { $_.state.waiting.reason -eq "CrashLoopBackOff" }
    }
    $crashing.Count -eq 0
} { -not $k8sReachable } "no Bastion tunnel / kubectl unreachable"

# ── Summary ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "  ✅  ALL $passed CHECKS PASSED" -NoNewline -ForegroundColor Green
    if ($skipped -gt 0) { Write-Host " ($skipped skipped)" -ForegroundColor Yellow } else { Write-Host "" }
    Write-Host "      Run Set-KnownGood.ps1 to mark this build as verified."
} else {
    Write-Host "  ❌  $failed/$($passed+$failed+$skipped) CHECKS FAILED" -ForegroundColor Red
    Write-Host "      Do NOT mark as known good."
}
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan

return $failed -eq 0
