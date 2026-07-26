# NouvellesDuPays Maintenance Log

## 2026-07-26 — Retroactive entry: initial Phase 1 deployment + TLS (this ops system created after the fact)

This ops/change-management system (`CHANGE_MGMT.md`, recovery points, `Test-Build.ps1`,
etc.) was created on 2026-07-26, after Phase 1 was already built and deployed. The
actual deployment work was logged in real time in **Tekeche's** `MAINTENANCE_LOG.md`
(since it touched shared OKE/NLB infrastructure and required that project's formal
change-management process) — see these entries there for full detail:

- `2026-07-25 21:58-23:58` — Initial deploy to the Livbiko OKE cluster: isolated
  `nouvellesdupays` namespace, dedicated `nouvellesdupays-nlb`, DNS cutover. Real bugs
  hit and fixed: unqualified Postgres image (CRI-O short-name rejection), `apps/web`
  Dockerfile/workspace-lockfile mismatch, Next.js standalone binding only to
  `$HOSTNAME`, new NLB's `is-preserve-source` defaulting wrong. Known open gap: port-80
  health-check quirk (HTTPS works, bare HTTP doesn't).
- `2026-07-26 07:58-08:56` — Real TLS certificate issued via manual Let's Encrypt
  DNS-01 (6 attempts, root cause was register.com's own inconsistent DNS propagation).
  **Expires 2026-10-24, no auto-renewal set up.**

No recovery points exist yet for anything in *this* log — the first one will be
whatever change comes next. Going forward, all changes to this project should be
logged here per `CHANGE_MGMT.md`.

## 2026-07-26 09:22-11:28 — Phase 2: country expansion, geo-aware landing, publisher dedup constraint

- **Type**: Three staged changes, proposed and approved individually before implementing (same pattern as Phase 1). First real end-to-end use of this project's own `ops/` system.
- **Stage 1 — country expansion (MEDIUM risk)**: 8 new countries (UK, France, USA, Brazil, India, Japan, UAE, Australia — one flagship per world region), 27 new individually-verified feeds. Recovery point `2026-07-26_09-51-23_before-phase-2-8-new-global-countries` (had to fix two real bugs in `New-RecoveryPoint.ps1`/`Invoke-Rollback.ps1` first — `$ErrorActionPreference = "Stop"` was turning harmless kubectl/oci stderr noise into terminating errors, masking a fully working Bastion tunnel as "unreachable"). Rebuilt the api image, re-ran migrate+seed, manually triggered the worker. **Real bug found and fixed**: `categorize()` crashed with `Cannot convert object to primitive value` on every article from Guardian (UK+Australia) and Fox News — rss-parser represents attributed `<category domain="...">` elements as `Object.create(null)` objects with no prototype/toString; fixed to extract the text properly. 45/48 → 48/48 feeds after the fix, 863+ articles ingested. Verified via live public API + a production screenshot.
- **Stage 2 — geo-aware landing (feature work, not separately risk-gated)**: IP geolocation (`ipapi.co`) with browser-locale fallback, lands visitors on their own country automatically, manual override always wins and persists to `localStorage`. Verified end-to-end against the real production site (this machine's IP → correctly detected United Kingdom, real same-day articles shown).
- **Stage 3 — publisher dedup constraint (HIGH risk, schema migration)**: added a `domain` column to `publishers` + `UNIQUE(country_id, domain)` index — catches accidental same-country duplicate registrations without breaking legitimate multi-country brands (found one real case first: `theguardian.com` correctly has separate GB and AU entries with different feeds; the constraint is deliberately country-scoped, not global, because of this). **Also fixed a real false-negative in `Get-ChangeRisk.ps1`** discovered while classifying this very change — "add domain column and constraint" scored MEDIUM because none of the exact HIGH_RISK keyword phrases matched; added `column`/`constraint`/`alter table`/`index`/`table` as triggers. Recovery point `2026-07-26_11-08-06_before-phase-2-stage-3-publisher-domain` (full DB dump, 1.4MB) taken before touching production. Migration + backfill tested locally first (including deliberately triggering the constraint to confirm it actually rejects a real duplicate) before applying to the cluster. **Real gotcha hit**: rebuilding the api image doesn't restart already-running pods — the migrate Job picked up the new image fine, but the live API pods kept serving the old one until an explicit `kubectl rollout restart` (same lesson as the web deployment earlier, now learned twice).
- **Also fixed**: `Test-Build.ps1`'s "exactly 5 countries" check, which broke the moment Stage 1 shipped — changed to `>= 5` so future country growth doesn't require a manual bump every time.
- **Verification**: `Test-Build.ps1` — 3/3 real checks pass (public site, public API, TLS expiry), 4 k8s-dependent checks correctly SKIPPED (no Bastion tunnel active at check time) rather than falsely failing. Marked **Build #1** Known Good (first one for this project).
- **Outcome**: Success. All three stages live in production, zero impact on Tekeche throughout (isolated namespace/NLB, no shared resources touched). Two real bugs found in the ops tooling itself while actually using it for the first time (`ErrorActionPreference`, `Get-ChangeRisk.ps1` keyword gap) — both fixed, both worth remembering for future `.ps1` scripts on this box.
