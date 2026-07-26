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
