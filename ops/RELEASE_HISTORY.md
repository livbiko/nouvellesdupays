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


## Build #14 — 2026-08-06 21:51

- **Repo commit**: 1cdc9a3d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: OKE node pool + all app workloads rebuilt from scratch after a silent ~3-day outage (ingress-nginx, cert-manager, Postgres restored from 2026-08-03 backup, OCIR dynamic-group IAM fix, NLB backends repointed to current nodes)


## Build #15 — 2026-08-07 00:55

- **Repo commit**: 3dfb1930 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Self-service publisher/feed registration: POST /api/publishers/register (live feed verification), /register-publisher page, CLI moderation script (db/review-submissions.js). Verified end-to-end with a real submission (BBC Afrique, now live for Cote dIvoire) plus broken-feed and duplicate-feed rejection tests.


## Build #16 — 2026-08-07 01:28

- **Repo commit**: 54259300 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Added Guinea-Bissau and Mauritania -- complete West Africa geographic coverage (192 countries total). Both use AllAfrica per-country feeds as the only viable source (no domestic outlet has a working RSS feed for either). Verified: countries + publishers live via public API, real articles confirmed ingested.


## Build #17 — 2026-08-07 02:59

- **Repo commit**: 91ee1d70 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Feed-path auto-discovery + Google News Sitemap ingestion (Tier 1+1b). Verified live: Agence Ecofin discovered via /feed (stale content, correctly zero-filtered by the 14-day cutoff -- discovery works, content just wasnt current); Le Point discovered via sitemap-news.xml with 100 real current articles ingested end-to-end. Both approved via db/review-submissions.js and confirmed live.


## Build #18 — 2026-08-07 11:31

- **Repo commit**: 13a80ab0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Add Jeune Afrique (FR), Financial Afrik (SN), Journal de Kinshasa + Habari RDC (CD) -- outlets discovered/verified during feed-discovery testing (Build #17). Confirmed live via public API and ingesting real articles (30/15/10/5 articles respectively). Test-Build.ps1's K8s reachability probe (15s timeout) is too aggressive for this environment's OCI exec-credential plugin (needs 30-90s+) and always self-skips those 4 checks; manually verified via kubectl with adequate timeouts instead: nodes Ready, api/web deployments 2/2 Running, postgres-0 Running, no CrashLoopBackOff pods, worker jobs Completed.


## Build #19 — 2026-08-07 13:06

- **Repo commit**: 296f876c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Widen Test-Build.ps1's k8s probe timeouts 15s/30s -> 60s (commit 296f876). Root cause: the reachability probe's 15s timeout was shorter than this environment's OCI exec-credential plugin needs, causing all 4 k8s-dependent checks to self-skip on every prior build regardless of actual cluster health. Verified live with a fresh Bastion tunnel: 7/7 checks passed (k8s checks ran for real, not skipped) -- confirms the timeout was the entire root cause. Tooling-only change, no application code/schema/seed data touched.


## Build #20 — 2026-08-08 00:07

- **Repo commit**: 0858d925 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Add discovery of announced <link rel=alternate> feed tags to publisher registration verification (commit 0858d92), plus add Sikafinance. Found while checking Koaci/Sikafinance for Tier-2 candidacy: Sikafinance actually has a real feed the site announces via a standard <link> tag, just not at any common guessed path -- prior 'no RSS' finding for it was wrong. Verified live end-to-end: submitted via the real public API with a deliberately wrong feed_url, confirmed the new discovery path found the real feed, approved via CLI, confirmed live + 30 real articles ingested via direct DB count. Koaci re-confirmed genuinely feedless (no announced link, no common path, no news sitemap). Test-Build.ps1: 7/7 checks passed with a live Bastion tunnel.

