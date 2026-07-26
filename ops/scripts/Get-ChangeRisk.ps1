<#
.SYNOPSIS
    Classifies a proposed change to NouvellesDuPays and shows what is required
    before proceeding. Run this to understand what approvals and steps are
    needed before any change.

.EXAMPLE
    .\Get-ChangeRisk.ps1 -Change "Add a new pilot country"
    .\Get-ChangeRisk.ps1 -Change "Update the NLB backend set"
#>
param(
    [Parameter(Mandatory)][string]$Change
)

$LOW_RISK = @(
    "ui text", "colour", "color", "documentation", "logging", "comment",
    "readme", "typo", "wording", "style", "css", "label", "translation",
    "non-functional", "refactor", "rename variable", "format", "add feed",
    "new feed", "new publisher"
)

$HIGH_RISK = @(
    "database migration", "schema change", "schema", "migrate", "postgres",
    "column", "constraint", "alter table", "index", "table",
    "kubernetes", "k8s", "deployment\.yaml", "statefulset", "cronjob manifest",
    "nlb", "load balancer", "backend set", "dns", "tls", "certificate", "cert",
    "secret", "ingress", "namespace", "oke", "ocir", "dockerfile", "kaniko",
    "bastion", "environment variable", "env var", "security", "auth"
)

$MEDIUM_RISK = @(
    "new feature", "api", "endpoint", "new country", "worker", "categorization",
    "category", "polling", "schedule", "frontend component", "globe", "route",
    "query", "index"
)

$changeLower = $Change.ToLower()
$risk = "MEDIUM"
foreach ($kw in $HIGH_RISK)   { if ($changeLower -match $kw) { $risk = "HIGH";   break } }
foreach ($kw in $LOW_RISK)    { if ($changeLower -match $kw) { $risk = "LOW";    break } }
if ($risk -ne "HIGH") {
    foreach ($kw in $MEDIUM_RISK) { if ($changeLower -match $kw) { $risk = "MEDIUM"; break } }
}

Write-Host "`n┌─────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│  NOUVELLESDUPAYS CHANGE RISK ASSESSMENT     │" -ForegroundColor Cyan
Write-Host "└─────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Change : $Change"

switch ($risk) {
    "LOW" {
        Write-Host "  Risk   : " -NoNewline; Write-Host "LOW" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Required steps:"
        Write-Host "    1. Review the change"
        Write-Host "    2. Confirm approval from user before implementing"
        Write-Host "    3. Commit after change"
        Write-Host ""
        Write-Host "  No recovery point needed for low-risk changes."
        Write-Host "  No maintenance window required."
    }
    "MEDIUM" {
        Write-Host "  Risk   : " -NoNewline; Write-Host "MEDIUM" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Required steps:"
        Write-Host "    1. Create recovery point:"
        Write-Host "       .\New-RecoveryPoint.ps1 -Description `"Before: $Change`""
        Write-Host "    2. Perform impact assessment"
        Write-Host "    3. Define rollback plan"
        Write-Host "    4. Get explicit user approval"
        Write-Host "    5. Implement change"
        Write-Host "    6. Run .\Test-Build.ps1"
        Write-Host "    7. If tests pass, run .\Set-KnownGood.ps1"
        Write-Host "    8. Remember: code changes need a rebuild+redeploy to go live (see CHANGE_MGMT.md)"
        Write-Host ""
        Write-Host "  No maintenance window required."
    }
    "HIGH" {
        Write-Host "  Risk   : " -NoNewline; Write-Host "HIGH ⚠️" -ForegroundColor Red
        Write-Host ""
        Write-Host "  STOP. This change requires a maintenance window." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Required steps:"
        Write-Host "    1. Propose maintenance window (time, duration, risks)"
        Write-Host "    2. Get explicit user approval for the window"
        Write-Host "    3. Confirm a live Bastion tunnel to the OKE cluster is open"
        Write-Host "    4. Create recovery point:"
        Write-Host "       .\New-RecoveryPoint.ps1 -Description `"Before: $Change`""
        Write-Host "    5. Explain full rollback plan before starting"
        Write-Host "    6. If this touches tekeche-nlb, ingress-nginx, node pool, or OCIR — treat as touching Tekeche too"
        Write-Host "    7. Implement change during approved window ONLY"
        Write-Host "    8. Run .\Test-Build.ps1 immediately after"
        Write-Host "    9. If tests fail → immediately run .\Invoke-Rollback.ps1 -Latest"
        Write-Host "    10. Log to MAINTENANCE_LOG.md"
    }
}
Write-Host ""
