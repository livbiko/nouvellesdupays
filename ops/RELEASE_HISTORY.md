# NouvellesDuPays Release History

Known Good Builds are recorded by `.\ops\scripts\Set-KnownGood.ps1` and logged
here automatically. See `KNOWN_GOOD_BUILDS.json` for the machine-readable registry.

## Build #1 — 2026-07-26 11:28

- **Repo commit**: 1f92883b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Phase 2 complete: 13 countries, geo-aware landing, publisher domain dedup constraint


## Build #2 — 2026-07-26 13:08

- **Repo commit**: ad2dc083 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Africa expansion: 46 new countries (all African nations), 144 new publishers, 59 countries total


## Build #3 — 2026-07-26 17:36

- **Repo commit**: 56dd32fc (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Europe expansion: 44 new countries, 129 new publishers, 103 countries total. Also fixed worker polling (real concurrency pool, batched inserts, process.exit fix) after feed count growth exposed deadline timeouts.


## Build #4 — 2026-07-26 19:40

- **Repo commit**: 334e08ce (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Asia expansion: 47 new countries, 165 new publishers, 150 countries total. Fixed two more worker bugs exposed at scale: missing fetch() timeout (hanging feeds starved worker-pool slots) and malformed publish dates crashing an entire feed batch insert.


## Build #5 — 2026-07-26 21:07

- **Repo commit**: a9473ec8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Americas expansion: 27 new countries, 96 new publishers, 177 countries total (Africa+Europe+Asia+Americas complete). Worker held steady at 496 feeds, 44s, zero crashes.


## Build #6 — 2026-07-26 21:28

- **Repo commit**: 8782f93d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Oceania expansion: 13 new countries, 18 new publishers, 190 countries total. GLOBAL EXPANSION COMPLETE -- all 6 populated continents fully covered.


## Build #7 — 2026-07-26 23:01

- **Repo commit**: 7d34ec1a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Security hardening: CORS restricted to production origin allowlist, API rate limiting (100 req/min per client) added.


## Build #8 — 2026-07-27 08:25

- **Repo commit**: 183dcbfa (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Production-readiness hardening: CORS restricted, rate limiting added, automated daily off-cluster Postgres backups (instance-principal auth, dedicated bucket, 30-day retention). Restore verified end-to-end: 190 countries / 514 publishers / 19602 articles restored cleanly.


## Build #9 — 2026-07-27 08:53

- **Repo commit**: e743582c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Added automated test suite (node:test): 35 tests across api/worker/shared, targeting the exact logic behind 4 real past production bugs. Refactored api/index.js and worker/poll.js for testability (behavior-identical, verified in production).


## Build #10 — 2026-07-27 13:57

- **Repo commit**: bc1d06ab (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Added automated monitoring and alerting: in-cluster CronJob every 15min, checks same 7 things as Test-Build.ps1, alerts via a dedicated OCI Notification topic (email) using instance-principal auth. Verified end-to-end incl. a real fired alert and a false-positive fix.


## Build #11 — 2026-07-27 14:11

- **Repo commit**: f238d401 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Fixed stale Africa-first web copy (now reflects 190-country global coverage), added OG/Twitter card metadata, robots.txt, and sitemap.xml.


## Build #12 — 2026-07-27 15:49

- **Repo commit**: d5d2e56b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Fixed port-80 HTTP: NLB health checker switched HTTP-expect-200 to TCP, plus a real missing NSG ingress rule for port 30080 (only 30443 was ever allowed). No code change -- pure infra fix, verified end-to-end from outside the network.


## Build #13 — 2026-07-27 18:11

- **Repo commit**: d5d2e56b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Automated TLS renewal: installed cert-manager cluster-wide (v1.16.2), HTTP-01 via letsencrypt-prod ClusterIssuer (port 80 now works, no more register.com manual DNS-01). New cert issued, valid to 2026-10-25, auto-renews ~30 days before expiry going forward. Verified staging flow first, zero impact on shared tekeche/livbiko hostnames on the same ingress-nginx controller.

