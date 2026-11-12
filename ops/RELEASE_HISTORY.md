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


## Build #21 — 2026-10-02 17:38

- **Repo commit**: f07cc828 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: PR #1: first-party analytics, Meta CAPI, feed-less publisher onboarding, YouTube submissions+landing pages. Migrations 011-013 applied, 7/7 Test-Build checks passed.


## Build #22 — 2026-10-03 02:02

- **Repo commit**: c9eb766a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Added 6 African political-commentary Local Voices YouTube channels (324 video_channels rows across 54 countries) + direct-write recovery-point workflow documented


## Build #23 — 2026-10-05 17:14

- **Repo commit**: 1e77875c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Meta tracking fixes 1e77875: debug kept out of Meta, Pixel params=CAPI, external_id


## Build #24 — 2026-10-07 23:18

- **Repo commit**: 4de5b2b8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Headline cleanup (fix/headline-cleanup 77adb63): entities decoded + whitespace trimmed at ingestion (worker) and on API output; api sha256:95a7126d, worker sha256:01b4f985; rollback api f7ccaf0a / worker 719cafeb


## Build #25 — 2026-10-08 03:44

- **Repo commit**: ff39405d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Africa Voices + data cleanup (main ff39405 incl. 004/009 re-run fixes): migration 014, 7 Africa Voices, 8 TV replacements + TBC, 29 wrong channels removed, 138 source_types, social links, 2 QA publishers deleted, 23 dead -> unavailable. api c203fc1c, web f93389b9; rollback api 95a7126d / web 0321770c + rollback_data.sql

## Build #26 — 2026-10-08 03:58

- **Repo commit**: 14b800e3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Ops-only: Test-Build worker check judges the newest FINISHED worker run (was false-failing while a run was in progress). No app change; images unchanged from Build #25.


## Build #27 — 2026-10-08 04:38

- **Repo commit**: 82715504 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Video player uploads-playlist fallback (YouTube RSS feeds 404) + 19 resurfaced wrong Live Now rows deleted. web 85ad524b (rollback f93389b9 + rollback_video_channels.sql)


## Build #28 — 2026-10-08 04:50

- **Repo commit**: c2587c5a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Ops-only: Test-Build sets ErrorActionPreference=Continue + StrictMode Off so its k8s checks run correctly when invoked from Set-KnownGood (were always SKIPPED). No app change (images as Build #27).


## Build #29 — 2026-10-08 05:24

- **Repo commit**: 90093ad5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: 21 official National TV channels for 20 African countries (add_national_tv.sql); National-TV-less African countries 30 -> 10. Rollback: ops/release-national-tv/rollback_national_tv.sql


## Build #30 — 2026-10-08 09:41

- **Repo commit**: e96abc11 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: publisher classification round 2 - 396 publishers typed; only 28 of 561 remain OTHER. Rollback: ops/release-publisher-types/rollback_publisher_types.sql


## Build #31 — 2026-10-08 10:05

- **Repo commit**: c60c87af (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: OC Media/On.ge fix - publisher 1066 renamed On.ge (its real outlet, ka), new OC Media (8343) on oc-media.org with its editorial profile; seed corrected (4182b65). Rollback: ops/release-ocmedia/rollback_ocmedia.sql


## Build #32 — 2026-10-08 11:46

- **Repo commit**: 986f8f2d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Somalia: 7 verified sources (Hiiraan, Somali Guardian, Somali Dispatch, Horseed, Goobjoog, Caasimada, Kaab TV), 3 dead retired; worker caps future publication dates (be65e4b). Rollback: ops/release-somalia-dates/rollback_somali_sources.sql + old-worker-image.txt


## Build #33 — 2026-10-08 12:56

- **Repo commit**: 6cb6c880 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: SONNA + Garowe Online as hourly crawled html sources; crawler parser_config date rule (Garowe 'Posted On', +03:00). Rollback: ops/release-crawler-somalia/rollback_crawled_sources.sql + old-worker-image.txt


## Build #34 — 2026-10-08 14:02

- **Repo commit**: 6ad77455 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Video landing pages fetched fresh (cache no-store): suspended/rejected videos 404 immediately (main 6ad7745)


## Build #35 — 2026-10-08 23:17

- **Repo commit**: 259db302 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Media discovery worker: migration 015, hourly discovery CronJob, /admin/discovery review page (main 259db30); 2026-09-14 outreach data preserved


## Build #36 — 2026-10-08 23:45

- **Repo commit**: a4cb4297 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Discovery worker: hacked news sites flagged 'compromised' instead of auto-rejected; Ghana News Agency (row 8) restored to review (main a4cb429)


## Build #37 — 2026-10-09 00:14

- **Repo commit**: bcbe050b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawler: quote-aware meta parsing - apostrophes no longer truncate crawled headlines/descriptions (main bcbe050)


## Build #38 — 2026-10-09 01:03

- **Repo commit**: 5058d861 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Discovery: already-publisher candidates closed (5), 40 checks per run (main 5058d86) - HIGH-classified window approved 00:44


## Build #39 — 2026-10-09 01:17

- **Repo commit**: f4c9240d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Discovery queue: duplicate Fraternite Matin row 162 rejected (publisher 7293 carries fratmat.info); data only


## Build #40 — 2026-10-09 11:27

- **Repo commit**: ea01b100 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Public Africa pages: /africa, 5 region pages, 53 country pages + 2 read-only API endpoints, sitemap/footer/globe links (main ea01b10)


## Build #41 — 2026-10-09 11:59

- **Repo commit**: b9795512 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Discovery worker: all five African regions (main b979551) - HIGH-classified window approved 11:41


## Build #42 — 2026-10-09 13:04

- **Repo commit**: e309abd3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Discovery: last 3 'Promote now' candidates promoted to pending submissions 132-134 (17 others promoted by owner in Decouverte); data only


## Build #43 — 2026-10-09 13:48

- **Repo commit**: e27638c5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Admin analytics: visitors by source + latest visitors with leads (main e27638c)


## Build #44 — 2026-10-09 14:41

- **Repo commit**: 6c4eced1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Shortlist: last 10 submissions approved as publishers 8904-8913 (owner approved the other 10); Aminiya+NAN Hausa=ha, Actusen=fr; data only


## Build #45 — 2026-10-09 15:21

- **Repo commit**: aef5eab5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Public API hides suspended publishers from the country publisher list (main aef5eab)


## Build #46 — 2026-10-09 15:56

- **Repo commit**: 7be221a2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Queue cleanup: 2 publishers suspended (lottery w/ casino spam, fatwa council), Benin Intelligent 202 restored, Ivoirematin moved SN->CI, 21 submissions rejected; data only


## Build #47 — 2026-10-10 00:19

- **Repo commit**: 62298408 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Approve refuses duplicates (same name/site/feed) instead of merging into an existing publisher (main 6229840)


## Build #48 — 2026-10-10 01:09

- **Repo commit**: 7cf532a0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 12 crawled publishers approved+activated (8914-8925); data only


## Build #49 — 2026-10-10 01:35

- **Repo commit**: f0bc0110 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawl fixes: Modern Ghana reconfigured (20 real articles); 5 uncrawlable/taken-over publishers suspended; 6 junk items removed; data only


## Build #50 — 2026-10-11 00:05

- **Repo commit**: ad3597b1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawler generic-title guard + entity decoding (main ad3597b); Graphic patterns fixed, 7 junk pages removed, 6 wrongly removed articles restored


## Build #51 — 2026-10-12 22:10

- **Repo commit**: e5dce399 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker crawl time limit (e5dce39, worker sha256:b7c19cff); data: NBC Namibia 270 -> nbcnews.na, Keydmedia suspended, submissions 168-171 approved


## Build #52 — 2026-10-12 23:09

- **Repo commit**: 83cbc068 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawler: unreadable robots.txt/listing pages are an error, not ok-0-new (83cbc06, worker sha256:668023a7)


## Build #53 — 2026-10-13 11:13

- **Repo commit**: 11c71596 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Youm7: Arabic feed dates (worker 11c7159, image sha256:e5658c57) + Youm7 switched to RSS and activated


## Build #54 — 2026-10-13 17:33

- **Repo commit**: 5d0741b0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: group 5 feed replacements - AIB rss 8973, Saudi Gazette sitemap-news 8974, The Standard sitemap-news 8975; old feeds 6762/1037/209 disabled


## Build #55 — 2026-10-13 18:20

- **Repo commit**: 6ee20ae5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: PA Media (6757) suspended - pa.media folded into pressassociation.com, no news feed left


## Build #56 — 2026-10-13 19:04

- **Repo commit**: 48efe201 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: removed PA Media (6757) 218 articles; saved in ops/release-pa-articles/articles-6757.csv


## Build #57 — 2026-10-13 19:53

- **Repo commit**: d7a88399 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Repo: .gitattributes *.csv -text (restore CSVs kept byte-for-byte)


## Build #58 — 2026-10-13 21:15

- **Repo commit**: e1f01e11 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Data: Citi Newsroom crawled html source 8977 (homepage + breaking-news, /20*/*/*); old RSS 6764 disabled


## Build #59 — 2026-10-13 23:10

- **Repo commit**: 09bcf289 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker: categorizer word-start + accent folding (09bcf28); 29,511 article categories backfilled


## Build #60 — 2026-10-14 00:33

- **Repo commit**: 6fdb75ba (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker: categorizer keyword exceptions (6fdb75b); 1,496 article categories backfilled


## Build #61 — 2026-10-14 10:15

- **Repo commit**: a443e998 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #61: categorizer counts whole-word 'foot' as sports only for French publishers (a443e99); 233 categories backfilled


## Build #62 — 2026-10-14 11:24

- **Repo commit**: 18930642 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #62: categorizer French-only 'mercato' + 'foot mercato' in every language (1893064); 107 categories backfilled


## Build #63 — 2026-10-14 20:33

- **Repo commit**: 649845c0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #63: categorizer URL-section fallback + 'mercato de la mode' exclusion (649845c); 316,468 categories backfilled in paced 500-row batches


## Build #64 — 2026-10-15 00:10

- **Repo commit**: 1ed76892 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #64: categorizer publisher-language keywords as a last pass (b215819+1ed7689); 87,459 categories backfilled in paced batches


## Build #65 — 2026-10-15 02:39

- **Repo commit**: f75b7c3f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #65: categorizer last-pass keywords for ru, el, vi, hu, pl, cs, is, lt, bg, sl (9888a93+f75b7c3); 28,955 categories backfilled in paced batches


## Build #66 — 2026-10-15 12:37

- **Repo commit**: 6c4d2f6f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Publisher languages: 1054 en->ar, 1537 fr->en; 53 categories backfilled


## Build #67 — 2026-10-15 15:27

- **Repo commit**: 88b0ba7c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker: back off polling of feeds that keep failing (88b0ba7)


## Build #68 — 2026-10-15 17:14

- **Repo commit**: 61d043f7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Dead feeds: 10 feed URLs fixed, 14 publishers marked unavailable (data only)


## Build #69 — 2026-10-15 17:48

- **Repo commit**: 24eaa00f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Undated feeds: worker fetch-time dates and headline suffix (24eaa00); Baltic Times and ElSalvador.com feeds fixed


## Build #70 — 2026-10-15 20:27

- **Repo commit**: a092c995 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Egypt: six sources added - Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24 (data only)


## Build #71 — 2026-10-15 21:14

- **Repo commit**: d55180a1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Egypt: editorial profiles for Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24 (data only)


## Build #72 — 2026-10-15 21:59

- **Repo commit**: 5a21f7de (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Egypt: editorial profile for Youm7 (data only)


## Build #73 — 2026-10-16 00:37

- **Repo commit**: 8f63a7b4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Editorial profiles: Journal de/du network (11 Yogam Group sites + Journal du Mali) and People 243 (data only)


## Build #74 — 2026-10-16 11:43

- **Repo commit**: 8f63a7b4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Editorial profiles: 33 West African publishers, release 2 (data only)


## Build #75 — 2026-10-16 12:14

- **Repo commit**: 8f63a7b4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Editorial profiles: 17 East African publishers, release 3 (data only)


## Build #76 — 2026-10-16 13:27

- **Repo commit**: af12e07e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Editorial profiles: the last 11 publishers, release 4 (data only)
- **Verification**: first Test-Build had the 4 k8s checks skipped (tunnel down); full re-run ~13:45 BST passed 7/7.


## Build #77 — 2026-10-16 15:32

- **Repo commit**: 3e122c6e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Actusen moved to actusen.sn (13 hijacked articles deleted, profile added); Notre Voie unavailable (data only)


## Build #78 — 2026-10-16 23:56

- **Repo commit**: 9e8e9f43 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Editorial profiles: Journal de Kinshasa and Journal du Tchad -> Yogam Group; Journal du Tchad homepage www -> apex (data only)


## Build #79 — 2026-10-17 08:42

- **Repo commit**: 927b395c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Ops scripts: New-RecoveryPoint retries + exit 2 on PARTIAL, Test-Build fails on skipped checks, Sql.ps1 keeps output on cleanup failure (no deploy)


## Build #80 — 2026-10-17 17:57

- **Repo commit**: 382755c3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Frozen feeds: 8 feed URLs replaced by current feeds (El Pais, ABC, Corriere, TBS, NHK, Agence Ecofin, The News, Daily Star; data only)


## Build #81 — 2026-10-17 18:33

- **Repo commit**: 8ef634bf (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: UDN feed replaced by udn.com/news/rssfeed (old feed returns blank items; data only)


## Build #82 — 2026-10-17 19:37

- **Repo commit**: 2177e7ac (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Milliyet switched from RSS (no article links) to the html crawler, news sections only (data only)


## Build #83 — 2026-10-17 20:26

- **Repo commit**: 794ffce3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Xinhua switched from frozen RSS to the html crawler, Beijing-time date rule (data only)


## Build #84 — 2026-10-17 20:39

- **Repo commit**: 8efc4a41 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Admin publishers page: silent publishers (no article in 14 days) shown amber + 'Silencieux' filter (web only)


## Build #85 — 2026-10-17 21:23

- **Repo commit**: d9397c8f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Stale sweep batch 2: Radio Okapi, SANA, Le Mauricien feeds fixed; RMI Government (hijacked), Liberte-Algerie, MadaGate, Madote unavailable; 20 undated 2022 articles deleted (data only)


## Build #86 — 2026-10-17 21:51

- **Repo commit**: 276f563b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Undated feeds: fetch_time for Hankyoreh, Le Parisien, Press TV, Kathmandu Post, El Khabar + 14-day published_at backfill (data only)


## Build #87 — 2026-10-17 22:36

- **Repo commit**: 2ad0d1be (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawler reads word dates + trims JSON-LD dates (worker); date rules for Seychelles Nation, ENA, Courrier Confidentiel


## Build #88 — 2026-10-17 23:21

- **Repo commit**: 3c6892ed (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker title_prefix option; Hoy.com.py switched from frozen RSS to the html crawler (worker + data)


## Build #89 — 2026-10-18 00:08

- **Repo commit**: f5ebd864 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Stale sweep batch 3: Centrafrique-Presse and RJDH (hijacked domains) unavailable; Le Patriote to the html crawler (data only)


## Build #90 — 2026-10-18 10:32

- **Repo commit**: 60a912e0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Weekly silent-publishers report: monitor image + CronJob nouvellesdupays-silent-report (Mon 07:00 UTC, OCI alerts topic)


## Build #91 — 2026-10-18 11:30

- **Repo commit**: 09afe841 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Crawler keeps non-Latin headlines (normTitle unicode); 24.kg switched from frozen RSS to the html crawler (worker + data)


## Build #92 — 2026-10-18 17:52

- **Repo commit**: 2fb1c246 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #92: silent report query uses idx_articles_publisher_published (old 120-day fetched_at aggregate timed out)


## Build #93 — 2026-10-18 19:00

- **Repo commit**: 5429b3f2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #93 Pacific feeds: 7 PINA No-Feed-Access placeholders deleted, PINA unavailable, APR category feeds, +5 APR publishers, +Island Times (Palau)


## Build #94 — 2026-10-18 20:24

- **Repo commit**: 88914a0e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #94: editorial profiles for APR Kiribati/Marshall Is./Nauru/Solomon Is./Tuvalu and Island Times (data only)


## Build #95 — 2026-10-19 11:09

- **Repo commit**: 29b3da60 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #95: crawler dates - GRTS clock-icon rule, Inforpress/Conakry Live undated=fetch_time, 14-day backfill of 5 publishers (data only)


## Build #96 — 2026-10-19 11:53

- **Repo commit**: 6f0dfe61 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #96: Myanmar +The Irrawaddy, +Myanmar Now, +DVB English (with profiles); BNI Online, LeTogolais, Comores Actualites unavailable (data only)


## Build #97 — 2026-10-19 13:07

- **Repo commit**: 50a796e1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #97: +Annahar, +NNA (LB), +Times Kuwait, +Oman Observer, +News of Bahrain, +la diaria, +Montevideo Portal (UY), +The Bruneian (data only)


## Build #98 — 2026-10-19 13:28

- **Repo commit**: 190c2791 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #98: editorial profiles for Annahar, NNA, Times Kuwait, Oman Observer, News of Bahrain, la diaria, Montevideo Portal, The Bruneian (data only)


## Build #99 — 2026-10-19 13:43

- **Repo commit**: ed48526f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #99: Sql.ps1 template retries tunnel blips 5x with backoff (10-60 s) instead of 3x 10 s (tooling only)


## Build #100 — 2026-10-19 14:03

- **Repo commit**: b3abcea2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #100: weekly silent report lists countries without news (no dated article 7+ days)


## Build #101 — 2026-10-19 14:35

- **Repo commit**: 5a5ee8f8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #101: Liechtensteiner Vaterland HTML crawl + profile for Liechtenstein (data only)


## Build #102 — 2026-10-19 15:00

- **Repo commit**: 79e2419d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #102: The Marshall Islands Journal + profile (data only)


## Build #103 — 2026-10-19 15:45

- **Repo commit**: e093ee97 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #103: second sources with profiles - Semana (CO), El Universo (EC), ABC Color (PY), La Prensa (PA), Midi Madagasikara (MG), HaitiLibre (HT) (data only)


## Build #104 — 2026-10-19 16:41

- **Repo commit**: 16d150c2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #104: worker label_utc_offset_hours option; Philippine Daily Inquirer added with offset 8 + profile (worker + data)


## Build #105 — 2026-10-19 17:43

- **Repo commit**: b4f0be5e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #105: label_utc_offset_hours on Tuoi Tre 7, Delfino 6, Jordan News 3, Punch 1, ActuCameroun 1 (data only)


## Build #106 — 2026-10-19 18:23

- **Repo commit**: a765e66c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #106: worker label_time_zone option (DST-aware); Cairo 24 Africa/Cairo, Dnevni Avaz + FENA Europe/Sarajevo (worker + data)


## Build #107 — 2026-10-19 18:49

- **Repo commit**: ffbd31e5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #107: profile corrections - Inquirer ownership (Inquirer.net = Rufino-Prieto; 2017 Ang deal was print), Island Times lawsuit outcome (data only)


## Build #108 — 2026-10-19 19:36

- **Repo commit**: 4c5d5d47 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #108: label_time_zone Europe/Paris on Jeune Afrique (data only)


## Build #109 — 2026-10-19 21:44

- **Repo commit**: b9ccbee6 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #109: migration 016 - publishers.slug/creator_kind, social_accounts (backfilled), audience_metrics, source_scores.score_kind (additive)


## Build #110 — 2026-10-19 22:21

- **Repo commit**: b82f109d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #110: /source/<slug> pages - GET /api/sources(/:slug), source links on country pages, sitemap (api + web)


## Build #111 — 2026-10-20 15:07

- **Repo commit**: a7b774ff (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #111: YouTube audience fetcher (worker CronJob) + GET /api/rankings + /africa/rankings page (api + web + worker + 18-youtube-audience-cronjob.yaml)


## Build #112 — 2026-10-20 16:39

- **Repo commit**: 21802a3e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #112: audience on publisher cards (top_subscribers) + YouTube verification uplift (api + web + worker)


## Build #113 — 2026-10-20 20:20

- **Repo commit**: 74eebd6f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #113: publisher scoring - activity/reliability/quality/audience/overall scores; /source pages show score grid; publishers sorted by overall_score


## Build #114 — 2026-10-20 20:58

- **Repo commit**: c906098e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #114: editorial score leaderboard on /africa/rankings; score band dot on publisher cards


## Build #115 — 2026-10-20 21:56

- **Repo commit**: 0180c12a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #115: featured publishers grid on /africa landing page


## Build #116 — 2026-10-20 22:26

- **Repo commit**: 92a64982 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #116: rank-in-country indicator on source pages


## Build #117 — 2026-10-21 01:42

- **Repo commit**: 04154788 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #117: publisher search page (/publishers) + GET /api/publishers


## Build #118 — 2026-10-21 03:03

- **Repo commit**: a2ea21ca (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #118: Sources link in nav + footer; /publishers metadata fix


## Build #119 — 2026-10-21 03:50

- **Repo commit**: 9167af98 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #119: +Africanews (CG, TV, en) publisher + feed + editorial profile


## Build #120 — 2026-10-21 10:09

- **Repo commit**: 5efd95b7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #120: +5 West Africa publishers (GH NG SN) with feeds + editorial profiles


## Build #121 — 2026-10-21 10:54

- **Repo commit**: 8343abd7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #121: +2 West Africa publishers (LR GM) with feeds + editorial profiles


## Build #122 — 2026-11-02 11:48

- **Repo commit**: 80e52548 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #122: YouTube creator hub - /api/youtube/channels + /youtube page


## Build #123 — 2026-11-02 12:09

- **Repo commit**: 80e52548 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #123: +3 East Africa publishers (TZ RW) with feeds + editorial profiles

## Build #124 — 2026-11-02 12:54

- **Repo commit**: 99c7d846 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #124: +3 North Africa publishers (MA TN SD) with feeds + editorial profiles


## Build #125 — 2026-11-02 13:43

- **Repo commit**: 8735d1f0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #125: +4 publishers (MV Atoll Times, Corporate Maldives; CI Mehielinfo, Artici.info) with feeds + editorial profiles


## Build #126 — 2026-11-02 15:22

- **Repo commit**: 028aca68 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #126: ops tooling - Test-Build/New-RecoveryPoint target on-prem production (8 checks, hostPath pg_dump)


## Build #127 — 2026-11-02 16:22

- **Repo commit**: aa0ec2b6 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #127: weekly silent report runs on on-prem production (CronJob Mon 07:00 UTC, Brevo delivery, real error text)


## Build #128 — 2026-11-02 16:47

- **Repo commit**: 43ddce68 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #128: 12 publishers promoted from the discovery queue (SM TM UY AD KZ AE CO LB BG ZW ES TZ) on on-prem production


## Build #129 — 2026-11-02 17:19

- **Repo commit**: d2da9916 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Admin login enabled on on-prem production (ADMIN_PASSWORD_HASH/ADMIN_TOKEN_SECRET wired into the api)


## Build #130 — 2026-11-02 19:36

- **Repo commit**: 058e24d8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Goobjoog News (SO) feed moved from dead /feed/ (404) to its news sitemap; 26 articles on first poll


## Build #131 — 2026-11-02 20:02

- **Repo commit**: 1008aa5a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: CamboJA News (KH) added on owner approval; Cambodia had no live source; 10 articles on first poll


## Build #132 — 2026-11-02 21:52

- **Repo commit**: 0009ca71 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: CBC Barbados (BB), The Tribune + ZNS Bahamas (BS) added on owner approval; 40 articles on first poll


## Build #133 — 2026-11-02 22:50

- **Repo commit**: be568a7f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 10 West African publishers (GW SL MR CV GM LR NE) + Kerr Fatou moved to kerrfatou.com; Sql-OnPrem UTF-8 fix + accent repair of #131/#132 profiles


## Build #134 — 2026-11-02 23:51

- **Repo commit**: 372ae587 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 6 West African publishers (GW SL MR TG); Kerr Fatou fetching after backoff reset


## Build #135 — 2026-11-03 00:22

- **Repo commit**: 2414b482 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 7 publishers for stale African countries (GQ DJ KM LS SS); 123 articles on first poll


## Build #136 — 2026-11-03 01:07

- **Repo commit**: 15fe0ea7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Slug fix (approve assigns /source slug) + worker logs network error cause; worker image refreshed on node (was cached since 10-31)


## Build #137 — 2026-11-03 01:16

- **Repo commit**: 15fe0ea7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 8 publishers for thin African countries (AO BI BW CF MG MU); 112 articles on first poll


## Build #138 — 2026-11-03 12:01

- **Repo commit**: e4837d1b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Worker happy-eyeballs per-address connect window 250ms -> 2.5s (e4837d1), worker image sha256:82c879ee pulled by hand; first run 0 ETIMEDOUT (was 6-9)


## Build #139 — 2026-11-03 17:25

- **Repo commit**: e0a17434 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: On-prem worker/discovery/publisher-scores/youtube-audience CronJobs imagePullPolicy IfNotPresent -> Always (window 17:09-17:30 UTC); manifest infra/k8s/onprem-dr/worker-cronjobs.yaml


## Build #140 — 2026-11-03 20:28

- **Repo commit**: 6a60637c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 13 RSS publishers for CM/ET/DZ/LY/ZM/ZA/MA/NA/MW/RW (9723-9735); 12 ingesting (339 articles), The Reporter Ethiopia's server answers 304 to unconditional GETs


## Build #141 — 2026-11-03 20:53

- **Repo commit**: 6a60637c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Capital News (GW, publisher 9709) HTML listing crawl; first try 19:45 timed out, 20:50 crawl stored 20 articles 10-28..11-03


## Build #142 — 2026-11-03 20:53

- **Repo commit**: 6a60637c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 8 RSS publishers for SD/MU/GA/TD/BW/SC (9744-9751), all ingesting (94 articles)


## Build #143 — 2026-11-03 21:42

- **Repo commit**: e9010c3e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 8 RSS publishers for AO/DZ/LY/BI/ET (9760-9767), all ingesting (85 articles)


## Build #144 — 2026-11-03 22:04

- **Repo commit**: 8502dcb3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Middle East: 13 publishers for SA/JO/BH/KW/QA/PS/SY/YE (9781-9793), all ingesting (655 articles); Arab News revive failed (Cloudflare challenge to Node fetch)


## Build #145 — 2026-11-03 22:28

- **Repo commit**: bad32081 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: 20 publishers for FJ/SB/VU/NI/GT/HN/PA/SV/DO/HT/JM (9794-9813); 19 ingesting (221 articles), En Segundos server sends uncompressed body labelled gzip


## Build #146 — 2026-11-04 01:07

- **Repo commit**: 3ee127dc (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #146: 16 RSS publishers for LA, BO, MO, CL, EC, PY, MY, TL (release-asia-southamerica-1), all 16 ingesting


## Build #147 — 2026-11-04 01:17

- **Repo commit**: a3027f0a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #147: 24 RSS publishers for BY, UA, AF, MV, KG, AZ, TM, NP, KZ, UZ, AM, GE, CA (release-eurasia-canada-1), all 24 ingesting


## Build #148 — 2026-11-04 12:33

- **Repo commit**: 573597c8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #148: 34 RSS publishers for Europe and the Middle East (release-europe-mideast-1), 32 ingesting; ERR Cloudflare 403 to Node, Information.dk malformed XML


## Build #149 — 2026-11-04 15:16

- **Repo commit**: 26db9ba9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 149: IIS stopgap - site 9 rewrite .50 -> .51 ingress (bypass failing dr-haproxy), 160/160 public 200, 0 x 502


## Build #150 — 2026-11-04 17:55

- **Repo commit**: e32eebe5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 150: 19 RSS publishers MX BR AR CO PE PH TH VN TR ID, all fetching (1198 articles)


## Build #151 — 2026-11-04 22:53

- **Repo commit**: 6eeac47e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 151: Namibian Sun (NA), fetching 49 articles


## Build #152 — 2026-11-04 23:10

- **Repo commit**: 6eeac47e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 152: Tchad Vision (TD), fetching 20 articles


## Build #153 — 2026-11-05 00:28

- **Repo commit**: bbc129a7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 153: Al Roya (OM) + Kaniva Tonga (TO), fetching 161 + 4 articles


## Build #154 — 2026-11-05 01:17

- **Repo commit**: 257302c9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 154: Le Point Sur (CI), fetching 20 articles


## Build #155 — 2026-11-05 02:08

- **Repo commit**: 9a4f9ac5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 155: OKE duplicate silent-report CronJob suspended; on-prem report unchanged


## Build #156 — 2026-11-05 02:25

- **Repo commit**: 8d83b45f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 156: on-prem cleanup - 5 evicted pods + 21 old failed Jobs (12 pods) deleted; 11-04 worker failure kept


## Build #157 — 2026-11-05 02:46

- **Repo commit**: f8e02bd8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 157: The Standard + Prachachat (TH), VnEconomy (VN), fetching 102 articles


## Build #158 — 2026-11-05 03:09

- **Repo commit**: 26cbb2db (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 158: Catholic Radio Network (SS) + Global Times Newspaper (SL), fetching 15 + 5 articles


## Build #159 — 2026-11-05 04:25

- **Repo commit**: c3762670 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 159: worker fresh rss-parser per feed + exclude_title_pattern (c376267, image ed2b779f, first run 04:20 ok)


## Build #160 — 2026-11-05 04:38

- **Repo commit**: c3762670 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 160: deleted 2018 misfiled/spam articles, reassigned 34, islaminfo unavailable, Business Bhutan exclude filter


## Build #161 — 2026-11-05 11:17

- **Repo commit**: 5b8ef791 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #161: 3 publishers BW (Mmegi, Guardian Sun) + CF (Radio Lengo Songo), ids 10043-10045


## Build #162 — 2026-11-05 11:33

- **Repo commit**: ee15c8c5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #162: 5 publishers ST/KM/GQ/SZ/DJ, ids 10051-10055


## Build #163 — 2026-11-05 11:48

- **Repo commit**: 17b85b83 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #163: recovered La Radio Macuto (GQ, publisher 236) on radiomacuto.org


## Build #164 — 2026-11-05 12:10

- **Repo commit**: e458a94b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #164: recovered Botswana Unplugged (BW, publisher 273)


## Build #165 — 2026-11-05 12:35

- **Repo commit**: 02864ae4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Builds #166-#167: Kampuchea Thmey (KH 10057); 11 publishers unavailable + 7 extra feeds disabled (owner: keep)


## Build #166 — 2026-11-05 13:30

- **Repo commit**: 6e23a675 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #166: part 1 Ada Derana undated fix (fetch_time + 2045 rows backfilled); part 2 Newswire, Daily Mirror (LK), Quds News Network (PS), 7iber (JO), ids 10062-10065, Daily Mirror label_time_zone Asia/Colombo


## Build #167 — 2026-11-05 14:31

- **Repo commit**: d74e8bde (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #167: The Bhutan Live (BT), RTL Today + Luxembourg Times (LU), ids 10069-10071


## Build #168 — 2026-11-05 14:47

- **Repo commit**: e7841086 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #168: NYT, Telegraph, Indian Express, SZ, Il Fatto Quotidiano, Japan Today, Chosun Ilbo, Radio-Canada, Le Temps (ids 10081-10089)


## Build #169 — 2026-11-05 16:07

- **Repo commit**: be0698a1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #169: Notes from Poland, NRC, ERT News, Magyar Nemzet, G4Media, MTV Uutiset, Dagbladet, TV 2 Nyheder, Publico (ids 10099-10107)


## Build #170 — 2026-11-05 16:24

- **Repo commit**: e2e1e864 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #170: Dagbladet undated live-blog items get fetch time (feed 10124), 4 rows backfilled


## Build #171 — 2026-11-05 17:19

- **Repo commit**: 4f85b406 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #171: State House Seychelles, AllAfrica Eritrea, BBC Tigrinya (ids 10111-10113)


## Build #172 — 2026-11-05 17:29

- **Repo commit**: 9c276870 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #172: Mauritius Times, Newsmada, RFI Madagascar (ids 10117-10119)


## Build #173 — 2026-11-05 19:07

- **Repo commit**: c752a142 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #173: Baghdad Today, 964, Portal Analitika, Pobjeda, RFA Lao, Business Advantage PNG (ids 10126-10131)


## Build #174 — 2026-11-05 19:29

- **Repo commit**: 497b0bf5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #174: 13 publishers for BE, BG, SG, TW, IR, BD, NZ, IL (ids 10145-10157)


## Build #175 — 2026-11-05 19:41

- **Repo commit**: 4ac1e2f9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #175: BBC Persian undated items take fetch time (feed 10173), 1 row backfilled


## Build #176 — 2026-11-05 19:55

- **Repo commit**: 0dc408b5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #176: RTHK, Ming Pao, Charter97, Radio Svaboda, Meydan TV, LRT English, The National, LBCI (ids 10166-10173)


## Build #177 — 2026-11-05 20:15

- **Repo commit**: f591fd39 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #177: La Nacion CR, Tico Times, Granma, elTOQUE, La Nacion PY, Newsroom Panama, Brecha (ids 10181-10187)


## Build #178 — 2026-11-05 20:50

- **Repo commit**: 7e9532d0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #178: 11 publishers for BZ, SR, MM, GY, TJ, TM, MK, SB (ids 10199-10209; iNews Guyana refused 403, under backoff)


## Build #179 — 2026-11-05 21:11

- **Repo commit**: b7436213 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #179: lie:zeit, Samoa Global News, Talanoa o Tonga (ids 10213-10215)


## Build #180 — 2026-11-05 22:10

- **Repo commit**: 499b4071 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #180: park 16 refused publishers, disable feeds 9453 and 9291 (worker accept_encoding option 499b407 committed, not yet deployed)


## Build #181 — 2026-11-05 23:00

- **Repo commit**: bb9f5a4a (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #181: Primicias, Edition.mv, WAM via news sitemaps (ids 10219-10221)


## Build #182 — 2026-11-05 23:44

- **Repo commit**: e3938ec2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #182: worker image bc88a4cb (day_first, charset+CDATA, accept_encoding) + Depeches de Brazzaville and En Segundos data steps


## Build #183 — 2026-11-06 00:28

- **Repo commit**: 43d2f14b (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #183: deleted 292 broken-accent duplicates, stripped CDATA wrapper from 10952 Correio headlines


## Build #184 — 2026-11-06 00:42

- **Repo commit**: 368b2cc5 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #184: La Tercera section feed (6758), TamTamInfo unavailable (205)


## Build #185 — 2026-11-06 23:42

- **Repo commit**: 0cc60694 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 185: deleted 6 spam rows (Leadership Thai 4, Business Bhutan 2); Leadership feed 8 Thai-script title filter; Bhutan feed 1020 filter + casino\w*, havadurumu\w*


## Build #186 — 2026-11-07 00:02

- **Repo commit**: ee5b8aa0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 186: index idx_articles_publisher_url_md5 on articles (publisher_id, md5(original_url)), CONCURRENTLY, 96 s, 156 MB, valid


## Build #187 — 2026-11-07 00:30

- **Repo commit**: 2e785f43 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 187: deleted 112,080 headline-edit duplicate copies (fetched since 10-08, newest row kept), CSV on dr-rke2; 26 new copies left from the old worker


## Build #188 — 2026-11-07 00:43

- **Repo commit**: 82e45810 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 188: worker image c532bf8d (2e785f4 applyHeadlineEdits): held URL updates the row; first run 888/897 ok, 104 new, headline updates logged, 0 new copies; rollback tag rollback-e70b019e


## Build #189 — 2026-11-07 00:48

- **Repo commit**: 82e45810 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build 189: deleted the 68 duplicate copies the old worker stored during #187 (CSV build187-deleted-copies-stragglers.csv on dr-rke2); copies left since 10-08: 0


## Build #190 — 2026-11-07 17:56

- **Repo commit**: dae47beb (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #190: deleted 2 Business Bhutan spam articles (CookieCasino, jeu responsable); feed 1020 filter now matches casino mid-word + jeu responsable + uitbetaling. Test-Build 8/8.


## Build #191 — 2026-11-07 22:07

- **Repo commit**: fdbfe9d4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #191: 8 discovery candidates rejected (euronews, Business Daily, ISOCEL, Edita, AFP, BNS, AFIS, Vision Group) per the Build #128 review. Test-Build 8/8.


## Build #192 — 2026-11-08 03:57

- **Repo commit**: 75be71da (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #192: 4 discovery candidates rejected (Monaco-Matin dup of 521, Seychelles Nation dup of 8949, Nehanda TV stale, Seha24). Monaco feed 9291 was already disabled. Test-Build 8/8.


## Build #193 — 2026-11-08 12:31

- **Repo commit**: 1a93478e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #193 (HIGH window, owner-approved): deleted 3 Business Bhutan rows by spam accounts wps_ebe76b6454/kaia54591 (Boomerang Bet, Coronavirus disease 2019, Lorem ipsum); feed 1020 filter + bet. Test-Build 8/8.


## Build #194 — 2026-11-08 12:46

- **Repo commit**: 62376348 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #194: UzA (UZ, English RSS) and Bernama (MY, news sitemap ms+en) added from the discovery queue; first poll 20 + 29 articles; Antara EN, Realites Senegal, Vision Group epaper/classifieds rejected. Test-Build 8/8.


## Build #195 — 2026-11-08 14:28

- **Repo commit**: 93fc5cb8 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #195: worker image 93fc5cb (sha256:2b6f1e85) - per-feed only_authors allowlist; rollback tag rollback-07556072


## Build #196 — 2026-11-08 14:43

- **Repo commit**: 5d7e9247 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #196: feed 1020 only_authors [businessbhutan] + 1 re-inserted spam row deleted


## Build #197 — 2026-11-08 15:44

- **Repo commit**: 0844c6d9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #197: worker image 0844c6d (sha256:510ee580) - retry feed parse without script blocks (Kigali Today); rollback tag rollback-2b6f1e85


## Build #198 — 2026-11-08 16:09

- **Repo commit**: 4dd65fef (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #198: Prensa Libre feed 1515 switched from 4.2 MB RSS to its news sitemap


## Build #199 — 2026-11-08 21:03

- **Repo commit**: 820c66e9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #199: Global Times feed 963 switched from dead outbrain.xml to its news sitemap


## Build #200 — 2026-11-08 21:18

- **Repo commit**: 4a996de1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #200: KOACI feed 7292 converted from general sitemap to html crawl


## Build #201 — 2026-11-09 01:11

- **Repo commit**: 03219a77 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #201: KOACI (feed 7292) 47 backlog articles' published_at set to their URL date 12:00 UTC


## Build #202 — 2026-11-09 11:43

- **Repo commit**: 899b92b2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #202: on-prem dump/psql scripts keep the DB password off the command line; dump gets TCP keepalives


## Build #203 — 2026-11-09 12:34

- **Repo commit**: 22624da2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #203: RTB feed 8921 -> https://www.rtb.bf/feed/ (rss); publisher still suspended since Build #49, so not polled yet


## Build #204 — 2026-11-09 12:45

- **Repo commit**: 339efce4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #204: RTB publisher 8923 reactivated; feed 8921 RSS polled, 10 articles


## Build #205 — 2026-11-09 17:11

- **Repo commit**: d8a1b531 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #205: on-prem DB restore path (onprem-restore.sh) in Invoke-Rollback; scratch restore test passed twice


## Build #206 — 2026-11-09 19:59

- **Repo commit**: c396d6a4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #206: on-prem DB app-role password rotated; API, worker, Sql-OnPrem and pg_dump verified on the new password


## Build #207 — 2026-11-10 00:39

- **Repo commit**: b6e90e44 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #207: Notre Voie suspended + feed disabled; web restarted to clear stale /source page


## Build #208 — 2026-11-10 01:05

- **Repo commit**: 54246a6f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #208: web image a517e6e8 (54246a6) - /source profiles fetched uncached; rollback tag rollback-36d0a39f


## Build #209 — 2026-11-10 01:14

- **Repo commit**: 996dfbf9 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #209: frozen NNA RSS feed 9050 disabled (owner option C), publisher stays active


## Build #210 — 2026-11-10 01:34

- **Repo commit**: 9a6e8e48 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #210b: 8 stale duplicate feeds disabled (primaries working)


## Build #211 — 2026-11-11 00:57

- **Repo commit**: 9f62c11e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #211: pg pool idle-client errors logged instead of crashing (api 05459ad4, worker fc6f0775; rollback tags rollback-beaf9c33 / rollback-3bd94a96)


## Build #212 — 2026-11-11 01:21

- **Repo commit**: da0a3525 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #212: Le Mauricien duplicate feed 9263 disabled (primary 301 keeps all articles)


## Build #213 — 2026-11-11 01:50

- **Repo commit**: ffce91c0 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #213: AllAfrica Mauritania -> fr.allafrica.com RDF, language fr


## Build #214 — 2026-11-11 02:10

- **Repo commit**: d1f22614 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #214: creator directory schema (migration 018), additive; rollback ops/release-creators-schema/reverse.sql


## Build #215 — 2026-11-11 03:53

- **Repo commit**: 46faa093 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #215: creator review queue (admin API + /admin/creators); api a79ca13c, web 8907e90d; rollback tags rollback-05459ad4 / rollback-dcf2759b


## Build #216 — 2026-11-11 04:42

- **Repo commit**: 271c8d99 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #216: audience values as JSON numbers; api 2dd9fed0; rollback tag rollback-a79ca13c


## Build #217 — 2026-11-11 05:13

- **Repo commit**: 5ad86427 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #217: creator agents (global + YouTube) + CronJob nouvellesdupays-creator-agents, all paused; worker c23b6a93; rollback tag rollback-363cfbb1


## Build #218 — 2026-11-11 05:59

- **Repo commit**: 4cf3d610 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #219: Liechtenstein-Journal (525) suspended, feed 525 off


## Build #219 — 2026-11-11 06:28

- **Repo commit**: 7c6ee61c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #218: YOUTUBE_API_KEY (optional secretKeyRef) on the API deployment; generation 53


## Build #220 — 2026-11-11 08:26

- **Repo commit**: fc5e2b74 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #221: YouTube discovery search v2 (country queries + language, rejection counts); worker c287ce7a; rollback tag rollback-c23b6a93


## Build #221 — 2026-11-11 10:52

- **Repo commit**: 701b5ddf (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #220: 4 robots whole-site-blocked feeds off (268 Namibian, 627 Balkan Insight, 967 KBS World, 1064 Civil.ge)


## Build #222 — 2026-11-11 11:28

- **Repo commit**: 95012ad6 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #222: daily robots.txt check CronJob (worker 936333d0, rollback-c287ce7a)


## Build #223 — 2026-11-11 13:29

- **Repo commit**: 1743a1ca (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #223: creators without a declared country kept as candidates under the search region + language (migration 019 creators.region, API filters/approval rule, admin page, worker search v3). Images api 1976492d, web 87f70a07, worker 234724fc; rollback tags api rollback-2dd9fed0, web rollback-555482c4, worker rollback-936333d0. Test-Build 8/8.


## Build #224 — 2026-11-11 13:38

- **Repo commit**: fa8083d6 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #224: queued YouTube discovery jobs 40-49 (RW SO SS SD TZ UG DZ EG LY MA) set to search v3 so they keep channels with no declared country. Data only (10 rows), ops/release-jobs-search-v3.


## Build #225 — 2026-11-11 14:13

- **Repo commit**: e1cf59d4 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #225: Aftonbladet feed 9984 moved from www.aftonbladet.se/rss.xml (404 since ~12:31) to rss.aftonbladet.se/rss2/small/pages/sections/senastenytt; poll 14:11 ok, 3 new. Data only, ops/release-aftonbladet-feed-url.


## Build #226 — 2026-11-11 14:42

- **Repo commit**: 4177ad96 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #226: YouTube search terms (main city, demonym; Arabic for North Africa) for 30 more African countries; 10 queued jobs 40-49 given the new queries. Worker 722c2ad1, rollback tag rollback-234724fc. Poll 14:40 on 722c2ad1: 869/884 ok, 259 new.


## Build #227 — 2026-11-11 14:58

- **Repo commit**: 890bc27e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #227: YouTube agent writes a 'Suggestion : rejeter' reviewer note for betting / public-institution / company names (status unchanged); 11 existing candidates annotated. Worker a0a65e14, rollback tag rollback-722c2ad1. Poll 14:55 on a0a65e14: 870/884 ok, 246 new.


## Build #228 — 2026-11-11 22:00

- **Repo commit**: 7e656ff7 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #228: owner bulk reject of 18 creator candidates (data only)


## Build #229 — 2026-11-11 22:30

- **Repo commit**: d512a78e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #229: 18 creator candidates typed media_brand (data only)


## Build #230 — 2026-11-11 22:55

- **Repo commit**: 0fd14b8e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #230: official_website evidence for Dakar Matin (data only)


## Build #231 — 2026-11-12 00:08

- **Repo commit**: 7e9f8ff3 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #231: public creator directory (api a8c3a164, web 5da3aaf4)


## Build #232 — 2026-11-12 00:30

- **Repo commit**: 5fa6d46d (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #232: removed two URL-less cross_link evidence rows (data only)


## Build #233 — 2026-11-12 00:50

- **Repo commit**: e54b2f7e (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #233: evidence URL required for checkable kinds (api b1a47225)


## Build #234 — 2026-11-12 01:10

- **Repo commit**: 604fa7b2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #234: admin evidence form without preselected type (web 48154c5f)


## Build #235 — 2026-11-12 02:27

- **Repo commit**: 921511d2 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #235: creator ranking engine (worker 6b352346, api f9daf887, web 73648b96)


## Build #236 — 2026-11-12 09:46

- **Repo commit**: c5bc3059 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #237: reject 14 creator candidates (data only, owner decision 11-12)


## Build #237 — 2026-11-12 09:57

- **Repo commit**: 056e0a5f (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #238: two media brands (87, 97) and one reject (92), data only


## Build #238 — 2026-11-12 10:27

- **Repo commit**: 2f4ba608 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #239: skip YouTube Topic channels, more rejection suggestions (worker 41ec6ef5, rb 8bc57f60)


## Build #239 — 2026-11-12 11:27

- **Repo commit**: 2b29bf7c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #236: full YouTube error reason in discovery errors (worker 8bc57f60; verified 11:25)


## Build #240 — 2026-11-12 11:27

- **Repo commit**: 2b29bf7c (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #240: retry before the hourly run, banks and insurers flagged (worker 32abd73d, rb 41ec6ef5)


## Build #241 — 2026-11-12 14:16

- **Repo commit**: 428f89f1 (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #241: YouTube channel lookups in batches of 50, Somalia searched without language hint, jobs 40/41/43 re-queued (worker d406db58, rollback-32abd73d)


## Build #242 — 2026-11-12 16:01

- **Repo commit**: d212cbba (main)
- **Tests**: passed
- **Production-safe**: Yes
- **Note**: Build #242: hourly YouTube run explains quota waits; jobs 40/41/43 moved to front (worker 1d367a3e, rollback-d406db58)

