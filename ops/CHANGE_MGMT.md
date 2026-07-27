# NouvellesDuPays Change Management Rules

These rules apply to ALL changes in the NouvellesDuPays project working directory
(`C:\inetpub\wwwroot\nouvellesdupays`). Adapted from the Tekeche project's proven
process (`tekeche/CHANGE_MGMT.md`) for this project's actual stack: a single git
repo (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `db/`), PostgreSQL
running as a StatefulSet inside the Livbiko OKE cluster (not MongoDB/PM2), and a
dedicated NLB (`nouvellesdupays-nlb`) — separate from Tekeche's own `tekeche-nlb`.

## Before ANY Change

1. Run `.\ops\scripts\Get-ChangeRisk.ps1 -Change "description"` to classify the risk.
2. Follow the protocol for that risk level — no exceptions.

## Risk Levels and Required Protocol

### LOW RISK
Examples: UI text/copy, colours, logging, comments, documentation, non-functional
refactoring, adding a new RSS feed to an existing pilot country.

- Get user approval before implementing
- Commit after change
- No recovery point required

### MEDIUM RISK
Examples: new API endpoint, new country/publisher onboarding, worker/categorization
logic changes, new frontend component, feed-polling schedule changes.

- Create recovery point FIRST: `.\ops\scripts\New-RecoveryPoint.ps1 -Description "Before: ..."`
- State impact assessment before implementing
- Get explicit user approval
- Run `.\ops\scripts\Test-Build.ps1` after change
- If tests fail → immediately run `.\ops\scripts\Invoke-Rollback.ps1 -Latest`
- If tests pass → run `.\ops\scripts\Set-KnownGood.ps1`

### HIGH RISK
Examples: database schema/migration, Kubernetes manifest changes (Deployments,
StatefulSet, CronJob), the NLB or its listeners/backend-sets, DNS records, TLS
certificate, Secrets, Ingress, namespace-level changes, OCIR/image changes,
anything touching `tekeche-nlb` or another shared/production resource.

- STOP and do NOT implement immediately
- Propose a maintenance window: expected duration, risks, rollback procedure, validation checklist
- Wait for explicit user approval of the maintenance window
- Create recovery point before starting
- Implement ONLY during the approved window
- Run `Test-Build.ps1` immediately after
- If ANY test fails → immediately invoke rollback (do not continue)
- Log to `MAINTENANCE_LOG.md`
- **If the change touches anything outside the `nouvellesdupays` namespace/NLB/DNS
  zone (i.e. anything Tekeche also depends on)**: this is the highest-stakes
  category — see the "shared infrastructure" note below.

## A note on shared infrastructure

NouvellesDuPays deliberately runs in its own isolated Kubernetes namespace with its
own dedicated NLB, so most changes here have zero blast radius on Tekeche. The
exceptions worth remembering:
- The underlying OKE **cluster** (nodes, `ingress-nginx` controller) is shared with
  Tekeche. A cluster-wide change (e.g. upgrading `ingress-nginx`, changing node pool
  size) affects both projects and needs sign-off treating it as touching Tekeche too.
- Both projects use the OCIR registry `lhr.ocir.io/lr14abpkfrxj` and the same
  Bastion (`tekeche-bastion`) for cluster access — these are shared credentials/
  access paths, not shared application state, but still worth being careful with.

## Known architectural limitation: code rollback is NOT a live-reload

Unlike Tekeche (PM2 `reload` picks up reverted code directly from disk), this
project's `apps/api`/`apps/web`/`apps/worker` run as **container images** built via
in-cluster Kaniko jobs from the git repo. `Invoke-Rollback.ps1`'s code rollback only
resets the **git repo** to the recorded commit — it does **not** automatically
rebuild and redeploy images. After a code rollback, if the bad code was already
built into a running image, you must also:
```
kubectl delete job kaniko-build-nouvellesdupays-<api|web|worker> -n nouvellesdupays
kubectl apply -f infra/k8s/ci/kaniko-build-<api|web|worker>.yaml
kubectl rollout restart deployment/nouvellesdupays-<api|web> -n nouvellesdupays
```
The database rollback (Postgres restore) IS immediately live once run, since it
restores directly into the running StatefulSet's database.

## Recovery Point Location

`C:\inetpub\wwwroot\nouvellesdupays\ops\recovery-points\`

## Key Scripts

```powershell
cd C:\inetpub\wwwroot\nouvellesdupays\ops\scripts

.\Get-ChangeRisk.ps1 -Change "description"    # Classify a change
.\New-RecoveryPoint.ps1 -Description "..."    # Create recovery point (git state + Postgres dump + k8s manifest snapshot)
.\Invoke-Rollback.ps1 -Latest                 # Rollback to last point
.\Test-Build.ps1                              # Verify build (public site + API + k8s health + worker freshness + TLS expiry)
.\Set-KnownGood.ps1 -BuildNote "..."          # Mark build as verified
```

## Known Good Builds Registry

`C:\inetpub\wwwroot\nouvellesdupays\ops\KNOWN_GOOD_BUILDS.json`

## Kubernetes access prerequisite

Several scripts (`New-RecoveryPoint.ps1`, `Invoke-Rollback.ps1`, parts of
`Test-Build.ps1`) need `kubectl` access to the OKE cluster, which requires an
active Bastion tunnel (not auto-connected — see `tekeche`'s
`reference_oke_bastion_access` notes for the session-per-use pattern: create an
`oci bastion session create-port-forwarding` session targeting `10.0.5.6:6443`,
then `ssh -N -L 16443:10.0.5.6:6443 ...`). Checks that need `kubectl` will report
`SKIPPED` with a clear message if the tunnel isn't up, rather than failing the
whole run — but a recovery point taken without a live tunnel will be missing its
Postgres dump and k8s state snapshot, which defeats its purpose. Always confirm
the tunnel is live before `New-RecoveryPoint.ps1`/`Invoke-Rollback.ps1` for
anything above LOW risk.

## Certificate renewal — automated since 2026-07-27

The TLS certificate for `nouvellesdupays.com` is managed by `cert-manager`
(installed cluster-wide 2026-07-27, see `MAINTENANCE_LOG.md`), via the
`letsencrypt-prod` `ClusterIssuer` and HTTP-01 validation (viable since the
port-80 fix the same day — no more register.com manual DNS-01 steps).
The `Certificate` resource is `infra/k8s/15-certificate.yaml`, targeting the
same `nouvellesdupays-tls` secret the Ingress already references. cert-manager
renews automatically ~30 days before expiry with no manual intervention.
Current cert valid to **2026-10-25**. `Test-Build.ps1` still checks and warns
if a cert is ever within 14 days of expiry, as a backstop in case renewal
itself fails silently (e.g. an ACME rate-limit or DNS issue) — if that
warning ever fires, check `kubectl describe certificate nouvellesdupays-tls -n
nouvellesdupays` first.

## Subscription Usage Check

Before starting a task that will take more than ~10 tool calls:
- Estimate scope and mention it to the user
- If there is a risk of running out of context before completing a high-risk change
  (especially database migrations, NLB/DNS/TLS changes), STOP and ask to split the work
- Never leave a high-risk change half-implemented
