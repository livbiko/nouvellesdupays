# NouvellesDuPays Backup History

Recovery points are created by `.\ops\scripts\New-RecoveryPoint.ps1` and logged
here automatically. See `CHANGE_MGMT.md` for when a recovery point is required.

## 2026-10-03 00:50:00 — Before adding 6 African political-commentary YouTube channels to video_channels

- **ID**: 2026-10-03_01-29-14_before-adding-6-african-political-commen
- **Reason**: User requested adding Local Voices channels (Nathalie Yamb, Bantu Media Authentique, Kemi Seba, Panafrican Média TV, AFRICA-MÉDIA TV, Media Afrique News) via direct DB write across all 54 African countries — no admin endpoint exists for video_channels writes
- **Repo commit**: (see recovery-points/2026-10-03_01-29-14_.../git-state.txt)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-03T00-48-20Z.sql.gz (514 MB, triggered manually after New-RecoveryPoint.ps1's own 200s wait loop timed out on the same job before it finished — job completed in 105s, backup confirmed fresh in-bucket afterward)
- **Impact**: Low (additive content rows only, no schema change)
- **Files affected**: video_channels table rows
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-03_01-29-14_before-adding-6-african-political-commen"` (restores DB from the above object) or `DELETE FROM video_channels WHERE created_at >= '2026-10-03 00:50:00'` for a narrower rollback of just this change

## 2026-07-26 09:51:45 — Before Phase 2: 8 new global countries

- **ID**: 2026-07-26_09-51-23_before-phase-2-8-new-global-countries
- **Reason**: Country expansion, MEDIUM risk per Get-ChangeRisk
- **Repo commit**: 4eb601b7 (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low (additive seed data, no schema change)
- **Files affected**: db/seed/data.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_09-51-23_before-phase-2-8-new-global-countries"`


## 2026-07-26 09:53:48 — Before Phase 2: 8 new global countries

- **ID**: 2026-07-26_09-53-29_before-phase-2-8-new-global-countries
- **Reason**: Country expansion, MEDIUM risk per Get-ChangeRisk
- **Repo commit**: 4eb601b7 (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low (additive seed data, no schema change)
- **Files affected**: db/seed/data.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_09-53-29_before-phase-2-8-new-global-countries"`


## 2026-07-26 09:55:12 — Before Phase 2: 8 new global countries

- **ID**: 2026-07-26_09-54-55_before-phase-2-8-new-global-countries
- **Reason**: Country expansion, MEDIUM risk per Get-ChangeRisk
- **Repo commit**: 4eb601b7 (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low (additive seed data, no schema change)
- **Files affected**: db/seed/data.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_09-54-55_before-phase-2-8-new-global-countries"`


## 2026-07-26 09:58:34 — Before Phase 2: 8 new global countries

- **ID**: 2026-07-26_09-57-19_before-phase-2-8-new-global-countries
- **Reason**: Country expansion, MEDIUM risk per Get-ChangeRisk
- **Repo commit**: 4eb601b7 (main)
- **K8s state captured**: True
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low (additive seed data, no schema change)
- **Files affected**: db/seed/data.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_09-57-19_before-phase-2-8-new-global-countries"`


## 2026-07-26 10:01:08 — Before Phase 2: 8 new global countries

- **ID**: 2026-07-26_09-59-42_before-phase-2-8-new-global-countries
- **Reason**: Country expansion, MEDIUM risk per Get-ChangeRisk
- **Repo commit**: 4eb601b7 (main)
- **K8s state captured**: True
- **DB dump**: 599.9 KB
- **Impact**: Low (additive seed data, no schema change)
- **Files affected**: db/seed/data.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_09-59-42_before-phase-2-8-new-global-countries"`


## 2026-07-26 11:09:45 — Before Phase 2 Stage 3: publisher domain dedup constraint

- **ID**: 2026-07-26_11-08-06_before-phase-2-stage-3-publisher-domain
- **Reason**: Schema migration, HIGH risk per Get-ChangeRisk
- **Repo commit**: 256aa2b6 (main)
- **K8s state captured**: True
- **DB dump**: 1439.8 KB
- **Impact**: Low (small table, backfill pre-verified conflict-free locally)
- **Files affected**: db/migrations/002_publisher_domain.sql, db/seed/run.js
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_11-08-06_before-phase-2-stage-3-publisher-domain"`


## 2026-07-26 11:46:14 — Before: Add North Africa countries (Morocco, Algeria, Tunisia, Libya, Egypt)

- **ID**: 2026-07-26_11-44-24_before-add-north-africa-countries-morocc
- **Reason**: 
- **Repo commit**: 3b93c639 (main)
- **K8s state captured**: True
- **DB dump**: 1563.5 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_11-44-24_before-add-north-africa-countries-morocc"`


## 2026-07-26 16:26:04 — Before: Add 44 European countries and their RSS publishers

- **ID**: 2026-07-26_16-24-50_before-add-44-european-countries-and-the
- **Reason**: 
- **Repo commit**: f7cec2b4 (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_16-24-50_before-add-44-european-countries-and-the"`


## 2026-07-26 16:30:10 — Before: Add 44 European countries and their RSS publishers

- **ID**: 2026-07-26_16-28-49_before-add-44-european-countries-and-the
- **Reason**: 
- **Repo commit**: f7cec2b4 (main)
- **K8s state captured**: True
- **DB dump**: 3744 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_16-28-49_before-add-44-european-countries-and-the"`


## 2026-07-26 19:15:42 — Before: Add 47 Asian countries and their RSS publishers

- **ID**: 2026-07-26_19-14-12_before-add-47-asian-countries-and-their
- **Reason**: 
- **Repo commit**: 5636b9a7 (main)
- **K8s state captured**: True
- **DB dump**: 9481.8 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_19-14-12_before-add-47-asian-countries-and-their"`


## 2026-07-26 20:59:01 — Before: Add 27 Americas countries and their RSS publishers

- **ID**: 2026-07-26_20-57-38_before-add-27-americas-countries-and-the
- **Reason**: 
- **Repo commit**: 6589b881 (main)
- **K8s state captured**: True
- **DB dump**: 12986.9 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_20-57-38_before-add-27-americas-countries-and-the"`


## 2026-07-26 21:19:11 — Before: Add 13 Oceania countries and their RSS publishers

- **ID**: 2026-07-26_21-17-44_before-add-13-oceania-countries-and-thei
- **Reason**: 
- **Repo commit**: 8e9f0141 (main)
- **K8s state captured**: True
- **DB dump**: 14370.4 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_21-17-44_before-add-13-oceania-countries-and-thei"`


## 2026-07-26 22:56:47 — Before: restrict CORS + add rate limiting to API

- **ID**: 2026-07-26_22-55-17_before-restrict-cors-add-rate-limiting-t
- **Reason**: 
- **Repo commit**: 7f4b564f (main)
- **K8s state captured**: True
- **DB dump**: 15300.6 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_22-55-17_before-restrict-cors-add-rate-limiting-t"`


## 2026-07-26 23:26:52 — Before: automated off-cluster Postgres backups (new bucket, IAM policy, CronJob)

- **ID**: 2026-07-26_23-25-22_before-automated-off-cluster-postgres-ba
- **Reason**: 
- **Repo commit**: f04ede10 (main)
- **K8s state captured**: True
- **DB dump**: 15487.9 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-26_23-25-22_before-automated-off-cluster-postgres-ba"`


## 2026-07-27 08:46:00 — Before: add automated test suite (api/worker refactor for testability)

- **ID**: 2026-07-27_08-44-16_before-add-automated-test-suite-api-work
- **Reason**: 
- **Repo commit**: 80f44f23 (main)
- **K8s state captured**: True
- **DB dump**: 22906.4 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-27_08-44-16_before-add-automated-test-suite-api-work"`


## 2026-07-27 09:04:26 — Before: add monitoring and alerting (topic, RBAC, monitor CronJob)

- **ID**: 2026-07-27_09-02-54_before-add-monitoring-and-alerting-topic
- **Reason**: 
- **Repo commit**: 60085d90 (main)
- **K8s state captured**: True
- **DB dump**: 20640.4 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-27_09-02-54_before-add-monitoring-and-alerting-topic"`


## 2026-07-27 14:07:32 — Before: fix stale web metadata, add robots.txt and sitemap.xml

- **ID**: 2026-07-27_14-05-58_before-fix-stale-web-metadata-add-robots
- **Reason**: 
- **Repo commit**: e12baa30 (main)
- **K8s state captured**: True
- **DB dump**: 29252 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-27_14-05-58_before-fix-stale-web-metadata-add-robots"`


## 2026-07-27 14:32:13 — Before: fix NLB port-80 health checker (HTTP-expect-200 -> TCP)

- **ID**: 2026-07-27_14-30-39_before-fix-nlb-port-80-health-checker-ht
- **Reason**: 
- **Repo commit**: d5d2e56b (main)
- **K8s state captured**: True
- **DB dump**: 32228 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-27_14-30-39_before-fix-nlb-port-80-health-checker-ht"`


## 2026-07-27 16:50:04 — Before: cert-manager install for automated TLS renewal

- **ID**: 2026-07-27_16-48-16_before-cert-manager-install-for-automate
- **Reason**: 
- **Repo commit**: d5d2e56b (main)
- **K8s state captured**: True
- **DB dump**: 27564.3 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-07-27_16-48-16_before-cert-manager-install-for-automate"`


## 2026-08-06 19:54:03 — Before: rebuild ingress-nginx/cert-manager, redeploy nouvellesdupays stack, restore Postgres from 2026-08-03 backup, fix NLB backends

- **ID**: 2026-08-06_19-47-49_before-rebuild-ingress-nginx-cert-manage
- **Reason**: 
- **Repo commit**: 1cdc9a3d (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-06_19-47-49_before-rebuild-ingress-nginx-cert-manage"`


## 2026-08-07 00:03:20 — Before: add self-service publisher/feed registration (new publisher_submissions table, POST /api/publishers/register, /register-publisher web page, CLI moderation script)

- **ID**: 2026-08-07_00-00-27_before-add-self-service-publisher-feed-r
- **Reason**: 
- **Repo commit**: 00b78f23 (main)
- **K8s state captured**: True
- **DB dump**: 192499.2 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_00-00-27_before-add-self-service-publisher-feed-r"`


## 2026-08-07 01:14:24 — Before: add Guinea-Bissau and Mauritania as new countries

- **ID**: 2026-08-07_01-12-51_before-add-guinea-bissau-and-mauritania
- **Reason**: 
- **Repo commit**: 0d465089 (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_01-12-51_before-add-guinea-bissau-and-mauritania"`


## 2026-08-07 02:22:11 — Before: auto feed-path discovery + sitemap-news ingestion fallback

- **ID**: 2026-08-07_02-19-16_before-auto-feed-path-discovery-sitemap
- **Reason**: 
- **Repo commit**: 8256acb8 (main)
- **K8s state captured**: True
- **DB dump**: 190929.9 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_02-19-16_before-auto-feed-path-discovery-sitemap"`


## 2026-08-07 11:09:36 — Before: add Jeune Afrique, Financial Afrik, Journal de Kinshasa, Habari RDC

- **ID**: 2026-08-07_11-06-44_before-add-jeune-afrique-financial-afrik
- **Reason**: 
- **Repo commit**: 65684e4f (main)
- **K8s state captured**: True
- **DB dump**: 192816.4 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_11-06-44_before-add-jeune-afrique-financial-afrik"`


## 2026-08-07 23:38:27 — Before: add Sikafinance + fix feed-discovery to check announced <link rel=alternate> tags

- **ID**: 2026-08-07_23-37-23_before-add-sikafinance-fix-feed-discover
- **Reason**: 
- **Repo commit**: b8b72e9d (main)
- **K8s state captured**: False
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_23-37-23_before-add-sikafinance-fix-feed-discover"`


## 2026-08-07 23:49:09 — Before: add Sikafinance + fix feed-discovery to check announced <link rel=alternate> tags

- **ID**: 2026-08-07_23-46-15_before-add-sikafinance-fix-feed-discover
- **Reason**: 
- **Repo commit**: b8b72e9d (main)
- **K8s state captured**: True
- **DB dump**: 175440.4 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-08-07_23-46-15_before-add-sikafinance-fix-feed-discover"`


## 2026-09-18 11:58:01 — After building on-prem DR mirror (4-phase: DB sync, image sync, TLS, DNS failover verification)

- **ID**: 2026-09-18_11-49-37_after-building-on-prem-dr-mirror-4-phase
- **Reason**: Full backup after major infra work
- **Repo commit**: ecbc9f51 (main)
- **K8s state captured**: True
- **DB dump**: 792428.2 KB
- **Impact**: Low
- **Files affected**: infra/k8s/onprem-dr/, apps/api/src/routes.js, apps/web/src/components/VideoSequence.tsx, apps/web/src/lib/types.ts, db/migrations/010_add_page_url_to_video_channels.sql
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-09-18_11-49-37_after-building-on-prem-dr-mirror-4-phase"`


## 2026-10-02 14:14:09 — Before: Add analytics/youtube-submission/no-feed-publisher schema migration (011)

- **ID**: 2026-10-02_14-03-29_before-add-analytics-youtube-submission
- **Reason**: 
- **Repo commit**: ecbc9f51 (main)
- **K8s state captured**: True
- **DB dump**: 1083182.2 KB
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-02_14-03-29_before-add-analytics-youtube-submission"`
- **CORRECTION (2026-10-02 14:20)**: this dump was actually TRUNCATED mid-row — `New-RecoveryPoint.ps1`'s `kubectl exec ... pg_dump` used a hardcoded 60s `--request-timeout`, too short for this DB's current size (1GB+, 841K+ articles); the script only checked file length > 0, not a real completion marker, so it falsely reported success. Directory deleted (not restorable). Fixed in `New-RecoveryPoint.ps1` (timeout widened to 1800s, added a `PostgreSQL database dump complete` completion check) and re-run — see the next entry below for the real recovery point.


## 2026-10-02 14:27:22 — Before: Add analytics/youtube-submission/no-feed-publisher schema migration (011)

- **ID**: 2026-10-02_14-16-46_before-add-analytics-youtube-submission
- **Reason**: 
- **Repo commit**: ecbc9f51 (main)
- **K8s state captured**: True
- **DB dump**: SKIPPED (no cluster access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-02_14-16-46_before-add-analytics-youtube-submission"`


## 2026-10-02 16:17:00 — Before: Add analytics/youtube-submission/no-feed-publisher schema migration (011)

- **ID**: 2026-10-02_16-17-00_before-add-analytics-youtube-submission
- **Reason**: Schema migration, HIGH risk per Get-ChangeRisk
- **Repo commit**: ecbc9f51 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-02T15-12-47Z.sql.gz (535784002 bytes, triggered on-demand via the nouvellesdupays-db-backup CronJob rather than New-RecoveryPoint.ps1 itself -- its PowerShell kubectl invocations hung unexplained on this run after two clean attempts; the equivalent bash kubectl calls worked fine, so this was constructed manually using the same verified mechanism the fixed script now uses. Worth re-testing the script directly in a future session.)
- **Impact**: Low (purely additive DDL -- CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP+ADD CONSTRAINT only, no column drops/renames, no data touched)
- **Files affected**: db/migrations/011_analytics_tracking_and_submissions.sql, packages/shared/src/analyticsEvents.js, ops/scripts/New-RecoveryPoint.ps1, ops/scripts/Invoke-Rollback.ps1
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-02_16-17-00_before-add-analytics-youtube-submission"`

## 2026-10-02 17:05:00 — Before: analytics/Meta/YouTube release (PR #1)

- **ID**: 2026-10-02_17-05-00_before-analytics-meta-youtube-release-pr1
- **Reason**: Schema migration + k8s manifest + new images, HIGH risk per Get-ChangeRisk
- **Repo commit**: f07cc82 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-02T15-59-54Z.sql.gz (536201154 bytes, triggered on-demand)
- **Impact**: Low-Medium (additive migrations; new api/web/worker images; rolling restart, no planned downtime)
- **Files affected**: db/migrations/011_analytics_tracking.sql, db/migrations/012_publisher_onboarding_no_feed.sql, db/migrations/013_youtube_submissions.sql, infra/k8s/01-configmap.yaml, infra/k8s/05-api.yaml, infra/k8s/07-web.yaml
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-02_17-05-00_before-analytics-meta-youtube-release-pr1"`

## 2026-10-03 01:32:56 — Before adding 7 African political commentary YouTube channels to video_channels

- **ID**: 2026-10-03_01-10-44_before-adding-7-african-political-commen
- **Reason**: User requested adding Local Voices channels (Franklin Nyamsi, Nathalie Yamb, Bantu Media Authentique, Kemi Seba, Panafrican Media TV, AFRICA-MEDIA TV, Media Afrique News) via direct DB write, no admin endpoint exists for video_channels
- **Repo commit**: c9eb766a (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low - additive content rows only, no schema change
- **Files affected**: video_channels table rows
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-03_01-10-44_before-adding-7-african-political-commen"`


## 2026-10-03 01:51:32 — Before adding 6 African political commentary YouTube channels to video_channels

- **ID**: 2026-10-03_01-29-14_before-adding-6-african-political-commen
- **Reason**: User requested adding Local Voices channels (Nathalie Yamb, Bantu Media Authentique, Kemi Seba, Panafrican Media TV, AFRICA-MEDIA TV, Media Afrique News) via direct DB write across African countries, no admin endpoint exists for video_channels writes
- **Repo commit**: c9eb766a (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low - additive content rows only, no schema change
- **Files affected**: video_channels table rows
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-03_01-29-14_before-adding-6-african-political-commen"`


## 2026-10-03 13:11:22 — Before: Build #23 tracking debug-flag fix + French form errors

- **ID**: 2026-10-03_13-10-05_before-build-23-tracking-debug-flag-fix
- **Reason**: 
- **Repo commit**: a20f7ad9 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-03_13-10-05_before-build-23-tracking-debug-flag-fix"`


## 2026-10-05 14:27:37 — Before: Meta tracking fixes 1e77875

- **ID**: 2026-10-05_14-06-45_before-meta-tracking-fixes-1e77875
- **Reason**: 
- **Repo commit**: 1e77875c (fix/meta-tracking-audit)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-05_14-06-45_before-meta-tracking-fixes-1e77875"`


## 2026-10-12 11:47:00 — Before: round-3 close-out - reject 31 discovery candidates + promote Puntland Post (.net); data reverse = ops/release-r3-close/reverse.sql

- **ID**: 2026-10-12_11-45-46_before-round-3-close-out-reject-31-disco
- **Reason**: 
- **Repo commit**: 1f1bf257 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-12_11-45-46_before-round-3-close-out-reject-31-disco"`


## 2026-10-12 12:45:27 — After: New-RecoveryPoint backup-job name fix (validation run)

- **ID**: 2026-10-12_12-40-52_after-new-recoverypoint-backup-job-name
- **Reason**: 
- **Repo commit**: 1f1bf257 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-12T11-42-27Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-12_12-40-52_after-new-recoverypoint-backup-job-name"`


## 2026-10-12 13:28:07 — Before: round-3 approvals - 32 submissions approved (24 feed live, 7 crawled active, Youm7 not activated) + 7 your-call decisions; data reverse = ops/release-approve-r3/reverse.sql

- **ID**: 2026-10-12_13-23-19_before-round-3-approvals-32-submissions
- **Reason**: 
- **Repo commit**: a69eae35 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-12T12-25-08Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-12_13-23-19_before-round-3-approvals-32-submissions"`


## 2026-10-12 21:35:05 — Before: round-3 follow-ups (NBC 270 to nbcnews.na, Keydmedia suspended, approve 168-171, worker crawl time limit)

- **ID**: 2026-10-12_21-30-29_before-round-3-follow-ups-nbc-270-to-nbc
- **Reason**: 
- **Repo commit**: a69eae35 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-12T20-32-08Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-12_21-30-29_before-round-3-follow-ups-nbc-270-to-nbc"`


## 2026-10-12 22:32:59 — Before: crawler reports unreadable robots.txt/listing pages as errors (worker image)

- **ID**: 2026-10-12_22-28-18_before-crawler-reports-unreadable-robots
- **Reason**: 
- **Repo commit**: 75130fd9 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-12T21-29-56Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-12_22-28-18_before-crawler-reports-unreadable-robots"`


## 2026-10-13 10:44:02 — Before: Youm7 Arabic feed dates (worker) + Youm7 switched to RSS and activated (data)

- **ID**: 2026-10-13_10-39-33_before-youm7-arabic-feed-dates-worker-yo
- **Reason**: 
- **Repo commit**: 11c71596 (feat/arabic-feed-dates)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T09-41-07Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_10-39-33_before-youm7-arabic-feed-dates-worker-yo"`


## 2026-10-13 12:56:16 — Before: group 5 feed replacements (AIB rss, Saudi Gazette + The Standard sitemap-news)

- **ID**: 2026-10-13_12-54-56_before-group-5-feed-replacements-aib-rss
- **Reason**: 
- **Repo commit**: 5d0741b0 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_12-54-56_before-group-5-feed-replacements-aib-rss"`


## 2026-10-13 13:02:48 — Before: group 5 feed replacements (AIB rss, Saudi Gazette + The Standard sitemap-news) full

- **ID**: 2026-10-13_12-58-06_before-group-5-feed-replacements-aib-rss
- **Reason**: 
- **Repo commit**: 5d0741b0 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T11-59-39Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_12-58-06_before-group-5-feed-replacements-aib-rss"`


## 2026-10-13 18:07:09 — Before: suspend PA Media 6757

- **ID**: 2026-10-13_18-02-19_before-suspend-pa-media-6757
- **Reason**: 
- **Repo commit**: 6ee20ae5 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T17-04-08Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_18-02-19_before-suspend-pa-media-6757"`


## 2026-10-13 18:45:59 — Before: remove PA Media 6757 articles

- **ID**: 2026-10-13_18-41-19_before-remove-pa-media-6757-articles
- **Reason**: 
- **Repo commit**: 48efe201 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T17-42-57Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_18-41-19_before-remove-pa-media-6757-articles"`


## 2026-10-13 19:07:48 — Before: gitattributes csv -text

- **ID**: 2026-10-13_19-06-36_before-gitattributes-csv-text
- **Reason**: 
- **Repo commit**: 1af9af27 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_19-06-36_before-gitattributes-csv-text"`


## 2026-10-13 20:48:24 — Before: Citi Newsroom crawled source

- **ID**: 2026-10-13_20-43-36_before-citi-newsroom-crawled-source
- **Reason**: 
- **Repo commit**: e1f01e11 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T19-45-12Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_20-43-36_before-citi-newsroom-crawled-source"`


## 2026-10-13 22:15:04 — Before: categorizer word-start fix + category backfill

- **ID**: 2026-10-13_22-10-27_before-categorizer-word-start-fix-catego
- **Reason**: 
- **Repo commit**: b2d66971 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T21-12-04Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_22-10-27_before-categorizer-word-start-fix-catego"`


## 2026-10-13 23:50:36 — Before: categorizer keyword exceptions + backfill

- **ID**: 2026-10-13_23-45-46_before-categorizer-keyword-exceptions-ba
- **Reason**: 
- **Repo commit**: 11e5c267 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-13T22-47-23Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-13_23-45-46_before-categorizer-keyword-exceptions-ba"`


## 2026-10-14 09:23:13 — Before: Categorizer French-only whole-word foot (publisher language) + backfill

- **ID**: 2026-10-14_09-21-45_before-categorizer-french-only-whole-wor
- **Reason**: 
- **Repo commit**: 4da74261 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_09-21-45_before-categorizer-french-only-whole-wor"`


## 2026-10-14 09:34:26 — Before: Categorizer French-only whole-word foot (publisher language) + backfill

- **ID**: 2026-10-14_09-29-19_before-categorizer-french-only-whole-wor
- **Reason**: 
- **Repo commit**: a443e998 (fix/categorize-foot-french)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-14T08-30-55Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_09-29-19_before-categorizer-french-only-whole-wor"`


## 2026-10-14 10:47:47 — Before: Categorizer French mercato + foot mercato + backfill

- **ID**: 2026-10-14_10-42-38_before-categorizer-french-mercato-foot-m
- **Reason**: 
- **Repo commit**: 18930642 (fix/categorize-mercato)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-14T09-44-14Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_10-42-38_before-categorizer-french-mercato-foot-m"`


## 2026-10-14 16:41:00 — Before: Categorizer URL section fallback + all-time backfill

- **ID**: 2026-10-14_16-35-39_before-categorizer-url-section-fallback
- **Reason**: 
- **Repo commit**: 649845c0 (fix/categorize-url-sections)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-14T15-37-14Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_16-35-39_before-categorizer-url-section-fallback"`


## 2026-10-14 18:51:29 — Before: Build #63 categorizer URL-section fallback + batched 316k category backfill

- **ID**: 2026-10-14_18-50-16_before-build-63-categorizer-url-section
- **Reason**: 
- **Repo commit**: 649845c0 (fix/categorize-url-sections)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_18-50-16_before-build-63-categorizer-url-section"`


## 2026-10-14 18:58:44 — Before: Build #63 categorizer URL-section fallback + batched 316k category backfill (with DB)

- **ID**: 2026-10-14_18-53-25_before-build-63-categorizer-url-section
- **Reason**: 
- **Repo commit**: 649845c0 (fix/categorize-url-sections)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-14T17-55-04Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_18-53-25_before-build-63-categorizer-url-section"`


## 2026-10-14 23:18:46 — Before: Build #64 categorizer publisher-language keywords + 87k category backfill

- **ID**: 2026-10-14_23-13-38_before-build-64-categorizer-publisher-la
- **Reason**: 
- **Repo commit**: 1ed76892 (fix/categorize-language-keywords)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-14T22-15-14Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-14_23-13-38_before-build-64-categorizer-publisher-la"`


## 2026-10-15 02:09:16 — Before: Build #65 categorizer keywords for ten more languages + category backfill

- **ID**: 2026-10-15_02-04-08_before-build-65-categorizer-keywords-for
- **Reason**: 
- **Repo commit**: f75b7c3f (fix/categorize-more-languages)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T01-05-44Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_02-04-08_before-build-65-categorizer-keywords-for"`


## 2026-10-15 12:17:35 — Before: publishers.language 1054 en->ar, 1537 fr->en + 53-article category backfill

- **ID**: 2026-10-15_12-11-46_before-publishers-language-1054-en-ar-15
- **Reason**: 
- **Repo commit**: 6c4d2f6f (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T11-13-19Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_12-11-46_before-publishers-language-1054-en-ar-15"`


## 2026-10-15 15:13:26 — Before: worker backoff for feeds that keep failing (88b0ba7)

- **ID**: 2026-10-15_15-08-24_before-worker-backoff-for-feeds-that-kee
- **Reason**: 
- **Repo commit**: 88b0ba7c (feat/feed-failure-backoff)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T14-09-58Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_15-08-24_before-worker-backoff-for-feeds-that-kee"`


## 2026-10-15 17:00:04 — Before: dead-feed fix (10 feed URLs, 14 publishers unavailable)

- **ID**: 2026-10-15_16-55-04_before-dead-feed-fix-10-feed-urls-14-pub
- **Reason**: 
- **Repo commit**: 61d043f7 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T15-56-38Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_16-55-04_before-dead-feed-fix-10-feed-urls-14-pub"`


## 2026-10-15 17:32:13 — Before: undated feeds - worker fetch-time dates + Baltic Times/ElSalvador feeds (24eaa00)

- **ID**: 2026-10-15_17-27-09_before-undated-feeds-worker-fetch-time-d
- **Reason**: 
- **Repo commit**: 24eaa00f (feat/undated-feed-items)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T16-28-42Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_17-27-09_before-undated-feeds-worker-fetch-time-d"`


## 2026-10-15 20:10:19 — Before: six Egyptian sources added (Daily News Egypt, Egyptian Streets, Mada Masr, El Watan News, Al Borsa, Cairo 24)

- **ID**: 2026-10-15_20-04-40_before-six-egyptian-sources-added-daily
- **Reason**: 
- **Repo commit**: a092c995 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T19-06-42Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_20-04-40_before-six-egyptian-sources-added-daily"`


## 2026-10-15 21:05:39 — Before: editorial profiles for six Egyptian publishers (8978-8983)

- **ID**: 2026-10-15_21-00-17_before-editorial-profiles-for-six-egypti
- **Reason**: 
- **Repo commit**: d55180a1 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T20-02-11Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_21-00-17_before-editorial-profiles-for-six-egypti"`


## 2026-10-15 21:41:47 — Before: editorial profile for Youm7 (8954)

- **ID**: 2026-10-15_21-40-03_before-editorial-profile-for-youm7-8954
- **Reason**: 
- **Repo commit**: 5a21f7de (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_21-40-03_before-editorial-profile-for-youm7-8954"`


## 2026-10-15 21:50:00 — Before: editorial profile for Youm7 (8954)

- **ID**: 2026-10-15_21-44-36_before-editorial-profile-for-youm7-8954
- **Reason**: 
- **Repo commit**: 5a21f7de (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T20-46-31Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-15_21-44-36_before-editorial-profile-for-youm7-8954"`


## 2026-10-16 00:29:25 — Before: editorial profiles for the Journal de/du network and People 243 (13 publishers)

- **ID**: 2026-10-16_00-23-59_before-editorial-profiles-for-the-journa
- **Reason**: 
- **Repo commit**: 8f63a7b4 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-15T23-25-49Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_00-23-59_before-editorial-profiles-for-the-journa"`


## 2026-10-16 11:35:32 — Before: editorial profiles for 33 West African publishers (release 2 of the profile gap)

- **ID**: 2026-10-16_11-30-35_before-editorial-profiles-for-33-west-af
- **Reason**: 
- **Repo commit**: 8f63a7b4 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-16T10-32-29Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_11-30-35_before-editorial-profiles-for-33-west-af"`


## 2026-10-16 12:06:58 — Before: editorial profiles for 17 East African publishers (release 3 of the profile gap)

- **ID**: 2026-10-16_12-02-19_before-editorial-profiles-for-17-east-af
- **Reason**: 
- **Repo commit**: 8f63a7b4 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-16T11-03-57Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_12-02-19_before-editorial-profiles-for-17-east-af"`


## 2026-10-16 12:40:33 — Before: editorial profiles for the last 11 publishers (release 4 of the profile gap)

- **ID**: 2026-10-16_12-32-23_before-editorial-profiles-for-the-last-1
- **Reason**: 
- **Repo commit**: 8f63a7b4 (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_12-32-23_before-editorial-profiles-for-the-last-1"`


## 2026-10-16 12:50:48 — Before: editorial profiles for the last 11 publishers (release 4 of the profile gap)

- **ID**: 2026-10-16_12-49-10_before-editorial-profiles-for-the-last-1
- **Reason**: 
- **Repo commit**: 8f63a7b4 (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_12-49-10_before-editorial-profiles-for-the-last-1"`


## 2026-10-16 13:21:06 — Before: editorial profiles for the last 11 publishers (release 4 of the profile gap)

- **ID**: 2026-10-16_13-16-06_before-editorial-profiles-for-the-last-1
- **Reason**: 
- **Repo commit**: af12e07e (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-16T12-18-01Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_13-16-06_before-editorial-profiles-for-the-last-1"`


## 2026-10-16 15:24:56 — Before: Actusen moved to actusen.sn (13 hijacked articles deleted, profile) and Notre Voie unavailable

- **ID**: 2026-10-16_15-19-38_before-actusen-moved-to-actusen-sn-13-hi
- **Reason**: 
- **Repo commit**: 3e122c6e (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-16T14-21-17Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_15-19-38_before-actusen-moved-to-actusen-sn-13-hi"`


## 2026-10-16 23:48:07 — Before: Journal de Kinshasa and Journal du Tchad Yogam profiles, Tchad homepage fix

- **ID**: 2026-10-16_23-42-47_before-journal-de-kinshasa-and-journal-d
- **Reason**: 
- **Repo commit**: 9e8e9f43 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-16T22-44-27Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-16_23-42-47_before-journal-de-kinshasa-and-journal-d"`


## 2026-10-17 08:24:36 — Before: ops script fixes (New-RecoveryPoint retries, Test-Build skipped=fail, Sql.ps1 cleanup)

- **ID**: 2026-10-17_08-23-18_before-ops-script-fixes-new-recoverypoin
- **Reason**: 
- **Repo commit**: 927b395c (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_08-23-18_before-ops-script-fixes-new-recoverypoin"`


## 2026-10-17 08:37:28 — Validation of the fixed New-RecoveryPoint (ops script fixes)

- **ID**: 2026-10-17_08-32-16_validation-of-the-fixed-new-recoverypoin
- **Reason**: 
- **Repo commit**: 927b395c (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T07-33-53Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_08-32-16_validation-of-the-fixed-new-recoverypoin"`


## 2026-10-17 17:38:15 — Before: frozen feeds - 8 feed URLs replaced by current feeds

- **ID**: 2026-10-17_17-33-27_before-frozen-feeds-8-feed-urls-replaced
- **Reason**: 
- **Repo commit**: 382755c3 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T16-35-02Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_17-33-27_before-frozen-feeds-8-feed-urls-replaced"`


## 2026-10-17 18:14:31 — Before: UDN feed replaced by udn.com/news/rssfeed

- **ID**: 2026-10-17_18-09-07_before-udn-feed-replaced-by-udn-com-news
- **Reason**: 
- **Repo commit**: 8ef634bf (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T17-10-45Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_18-09-07_before-udn-feed-replaced-by-udn-com-news"`


## 2026-10-17 19:18:17 — Before: Milliyet switched from RSS to the html crawler

- **ID**: 2026-10-17_19-12-30_before-milliyet-switched-from-rss-to-the
- **Reason**: 
- **Repo commit**: 2177e7ac (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T18-14-07Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_19-12-30_before-milliyet-switched-from-rss-to-the"`


## 2026-10-17 20:06:50 — Before: Xinhua switched from frozen RSS to the html crawler

- **ID**: 2026-10-17_20-01-38_before-xinhua-switched-from-frozen-rss-t
- **Reason**: 
- **Repo commit**: 794ffce3 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T19-03-15Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_20-01-38_before-xinhua-switched-from-frozen-rss-t"`


## 2026-10-17 21:04:33 — Before: stale sweep batch 2 - 3 feeds fixed, 4 publishers unavailable

- **ID**: 2026-10-17_20-59-25_before-stale-sweep-batch-2-3-feeds-fixed
- **Reason**: 
- **Repo commit**: d9397c8f (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T20-01-00Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_20-59-25_before-stale-sweep-batch-2-3-feeds-fixed"`


## 2026-10-17 21:44:17 — Before: undated feeds - fetch_time on 5 feeds + 14-day backfill

- **ID**: 2026-10-17_21-39-19_before-undated-feeds-fetch-time-on-5-fee
- **Reason**: 
- **Repo commit**: 276f563b (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T20-40-58Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_21-39-19_before-undated-feeds-fetch-time-on-5-fee"`


## 2026-10-17 22:14:09 — Before: crawler word dates (worker) + date rules on 3 crawled sources

- **ID**: 2026-10-17_22-09-14_before-crawler-word-dates-worker-date-ru
- **Reason**: 
- **Repo commit**: 2ad0d1be (feat/crawler-word-dates)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T21-10-51Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_22-09-14_before-crawler-word-dates-worker-date-ru"`


## 2026-10-17 22:59:23 — Before: Hoy title_prefix (worker) + Hoy switched to the html crawler

- **ID**: 2026-10-17_22-53-58_before-hoy-title-prefix-worker-hoy-switc
- **Reason**: 
- **Repo commit**: 3c6892ed (feat/hoy-title-prefix)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T21-55-34Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_22-53-58_before-hoy-title-prefix-worker-hoy-switc"`


## 2026-10-17 23:49:45 — Before: stale sweep batch 3 - 2 hijacked publishers unavailable, Le Patriote to the crawler

- **ID**: 2026-10-17_23-44-30_before-stale-sweep-batch-3-2-hijacked-pu
- **Reason**: 
- **Repo commit**: f5ebd864 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-17T22-46-08Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-17_23-44-30_before-stale-sweep-batch-3-2-hijacked-pu"`


## 2026-10-18 10:14:15 — Before: weekly silent-publishers report (monitor image + new CronJob)

- **ID**: 2026-10-18_10-09-37_before-weekly-silent-publishers-report-m
- **Reason**: 
- **Repo commit**: 60a912e0 (feat/silent-report)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-18T09-11-13Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-18_10-09-37_before-weekly-silent-publishers-report-m"`


## 2026-10-18 11:06:06 — Before: crawler unicode titles (worker) + 24.kg switched to the html crawler

- **ID**: 2026-10-18_11-00-39_before-crawler-unicode-titles-worker-24
- **Reason**: 
- **Repo commit**: 09afe841 (fix/crawler-unicode-titles)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-18T10-02-43Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-18_11-00-39_before-crawler-unicode-titles-worker-24"`


## 2026-10-18 17:38:05 — Before: Build #92 silent report query fix (monitor image rebuild)

- **ID**: 2026-10-18_17-32-03_before-build-92-silent-report-query-fix
- **Reason**: 
- **Repo commit**: dfe5dd94 (fix/silent-report-query)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-18T16-34-15Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-18_17-32-03_before-build-92-silent-report-query-fix"`


## 2026-10-18 18:47:26 — Before: Build #93 Pacific feeds (PINA placeholder rows, APR category feeds, 6 publishers)

- **ID**: 2026-10-18_18-42-19_before-build-93-pacific-feeds-pina-place
- **Reason**: 
- **Repo commit**: 5429b3f2 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-18T17-43-55Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-18_18-42-19_before-build-93-pacific-feeds-pina-place"`


## 2026-10-18 20:17:11 — Before: Build #94 editorial profiles for six Pacific publishers (8996-9001)

- **ID**: 2026-10-18_20-12-05_before-build-94-editorial-profiles-for-s
- **Reason**: 
- **Repo commit**: 88914a0e (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-18T19-13-39Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-18_20-12-05_before-build-94-editorial-profiles-for-s"`


## 2026-10-19 10:56:13 — Before: Build #95 crawler undated rows (GRTS, Inforpress, Conakry Live, Seychelles Nation, Courrier Confidentiel)

- **ID**: 2026-10-19_10-50-19_before-build-95-crawler-undated-rows-grt
- **Reason**: 
- **Repo commit**: 29b3da60 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T09-51-53Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_10-50-19_before-build-95-crawler-undated-rows-grt"`


## 2026-10-19 11:38:36 — Before: Build #96 Myanmar sources (Irrawaddy, Myanmar Now, DVB English) + 3 dormant publishers unavailable

- **ID**: 2026-10-19_11-32-54_before-build-96-myanmar-sources-irrawadd
- **Reason**: 
- **Repo commit**: 6f0dfe61 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T10-34-27Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_11-32-54_before-build-96-myanmar-sources-irrawadd"`


## 2026-10-19 12:36:48 — Before: Build #97 eight sources for LB, KW, OM, BH, UY, BN

- **ID**: 2026-10-19_12-24-50_before-build-97-eight-sources-for-lb-kw
- **Reason**: 
- **Repo commit**: 50a796e1 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T11-29-32Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_12-24-50_before-build-97-eight-sources-for-lb-kw"`


## 2026-10-19 12:53:10 — Before: Build #97 eight sources for LB, KW, OM, BH, UY, BN

- **ID**: 2026-10-19_12-46-07_before-build-97-eight-sources-for-lb-kw
- **Reason**: 
- **Repo commit**: 50a796e1 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T11-48-16Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_12-46-07_before-build-97-eight-sources-for-lb-kw"`


## 2026-10-19 13:20:44 — Before: Build #98 editorial profiles for the eight Build #97 publishers

- **ID**: 2026-10-19_13-15-22_before-build-98-editorial-profiles-for-t
- **Reason**: 
- **Repo commit**: 190c2791 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T12-17-06Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_13-15-22_before-build-98-editorial-profiles-for-t"`


## 2026-10-19 13:38:19 — Before: Sql.ps1 retry backoff (tooling only)

- **ID**: 2026-10-19_13-32-29_before-sql-ps1-retry-backoff-tooling-onl
- **Reason**: 
- **Repo commit**: ed48526f (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T12-34-07Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_13-32-29_before-sql-ps1-retry-backoff-tooling-onl"`


## 2026-10-19 13:55:00 — Before: Build #100 silent report countries section (monitor image rebuild)

- **ID**: 2026-10-19_13-50-05_before-build-100-silent-report-countries
- **Reason**: 
- **Repo commit**: b3abcea2 (feat/silent-report-countries)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T12-51-37Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_13-50-05_before-build-100-silent-report-countries"`


## 2026-10-19 14:23:22 — Before: Build #101 Liechtensteiner Vaterland HTML crawl

- **ID**: 2026-10-19_14-18-28_before-build-101-liechtensteiner-vaterla
- **Reason**: 
- **Repo commit**: 5a5ee8f8 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T13-20-13Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_14-18-28_before-build-101-liechtensteiner-vaterla"`


## 2026-10-19 14:48:16 — Before: Build #102 Marshall Islands Journal

- **ID**: 2026-10-19_14-42-53_before-build-102-marshall-islands-journa
- **Reason**: 
- **Repo commit**: 79e2419d (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T13-44-33Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_14-42-53_before-build-102-marshall-islands-journa"`


## 2026-10-19 15:31:05 — Before: Build #103 second sources + profiles for CO, EC, PY, PA, MG, HT

- **ID**: 2026-10-19_15-25-43_before-build-103-second-sources-profiles
- **Reason**: 
- **Repo commit**: e093ee97 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T14-27-33Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_15-25-43_before-build-103-second-sources-profiles"`


## 2026-10-19 16:20:49 — Before: Build #104 label_utc_offset_hours (worker) + Inquirer

- **ID**: 2026-10-19_16-15-39_before-build-104-label-utc-offset-hours
- **Reason**: 
- **Repo commit**: 16d150c2 (feat/label-utc-offset)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T15-17-15Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_16-15-39_before-build-104-label-utc-offset-hours"`


## 2026-10-19 17:17:23 — Before: Build #105 label_utc_offset_hours on five feeds

- **ID**: 2026-10-19_17-11-56_before-build-105-label-utc-offset-hours
- **Reason**: 
- **Repo commit**: b4f0be5e (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T16-13-37Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_17-11-56_before-build-105-label-utc-offset-hours"`


## 2026-10-19 17:53:37 — Before: Build #106 label_time_zone (worker) + three feeds

- **ID**: 2026-10-19_17-47-59_before-build-106-label-time-zone-worker
- **Reason**: 
- **Repo commit**: a765e66c (feat/label-time-zone)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T16-49-35Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_17-47-59_before-build-106-label-time-zone-worker"`


## 2026-10-19 18:42:14 — Before: Build #107 profile corrections (Inquirer, Island Times)

- **ID**: 2026-10-19_18-36-47_before-build-107-profile-corrections-inq
- **Reason**: 
- **Repo commit**: ffbd31e5 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T17-38-27Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_18-36-47_before-build-107-profile-corrections-inq"`


## 2026-10-19 19:11:19 — Before: Build #108 label_time_zone on Jeune Afrique

- **ID**: 2026-10-19_19-06-23_before-build-108-label-time-zone-on-jeun
- **Reason**: 
- **Repo commit**: 4c5d5d47 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T18-08-02Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_19-06-23_before-build-108-label-time-zone-on-jeun"`


## 2026-10-19 21:34:30 — Before: Build #109 migration 016 (media organisations and channels)

- **ID**: 2026-10-19_21-29-17_before-build-109-migration-016-media-org
- **Reason**: 
- **Repo commit**: b9ccbee6 (feat/media-organisations)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T20-30-55Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_21-29-17_before-build-109-migration-016-media-org"`


## 2026-10-19 22:04:14 — Before: Build #110 /source/<slug> pages (api + web)

- **ID**: 2026-10-19_21-59-10_before-build-110-source-slug-pages-api-w
- **Reason**: 
- **Repo commit**: 726c6644 (feat/source-pages)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-19T21-00-49Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-19_21-59-10_before-build-110-source-slug-pages-api-w"`


## 2026-10-20 13:42:54 — Before: Build #111 YouTube audience fetcher + rankings page (api + web + worker)

- **ID**: 2026-10-20_13-37-23_before-build-111-youtube-audience-fetche
- **Reason**: 
- **Repo commit**: 566a8f89 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T12-38-55Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_13-37-23_before-build-111-youtube-audience-fetche"`


## 2026-10-20 13:54:36 — Before: Build #111 YouTube audience fetcher + rankings page (api + web + worker)

- **ID**: 2026-10-20_13-49-47_before-build-111-youtube-audience-fetche
- **Reason**: 
- **Repo commit**: 566a8f89 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T12-51-21Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_13-49-47_before-build-111-youtube-audience-fetche"`


## 2026-10-20 14:53:38 — Before: Build #111 YouTube audience fetcher + rankings page (api + web + worker)

- **ID**: 2026-10-20_14-47-10_before-build-111-youtube-audience-fetche
- **Reason**: 
- **Repo commit**: a7b774ff (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T13-48-46Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_14-47-10_before-build-111-youtube-audience-fetche"`


## 2026-10-20 16:19:22 — Before: Build #112 audience on publisher cards + YouTube verification uplift

- **ID**: 2026-10-20_16-13-49_before-build-112-audience-on-publisher-c
- **Reason**: 
- **Repo commit**: 21802a3e (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T15-15-23Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_16-13-49_before-build-112-audience-on-publisher-c"`


## 2026-10-20 17:04:20 — Before: Build #113 publisher scoring

- **ID**: 2026-10-20_16-58-48_before-build-113-publisher-scoring
- **Reason**: 
- **Repo commit**: b9b896de (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T16-00-24Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_16-58-48_before-build-113-publisher-scoring"`


## 2026-10-20 20:43:39 — Before: Build #114 editorial score leaderboard

- **ID**: 2026-10-20_20-40-13_before-build-114-editorial-score-leaderb
- **Reason**: 
- **Repo commit**: c906098e (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_20-40-13_before-build-114-editorial-score-leaderb"`


## 2026-10-20 22:16:02 — Before: Build #116 rank-in-country

- **ID**: 2026-10-20_22-10-50_before-build-116-rank-in-country
- **Reason**: 
- **Repo commit**: 92a64982 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-20T21-12-26Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-20_22-10-50_before-build-116-rank-in-country"`


## 2026-10-21 00:20:32 — Before: Build #117 publisher search page

- **ID**: 2026-10-21_00-16-25_before-build-117-publisher-search-page
- **Reason**: 
- **Repo commit**: 04154788 (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_00-16-25_before-build-117-publisher-search-page"`


## 2026-10-21 01:31:23 — Before: Build #117 publisher search page

- **ID**: 2026-10-21_01-25-58_before-build-117-publisher-search-page
- **Reason**: 
- **Repo commit**: 04154788 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T00-27-39Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_01-25-58_before-build-117-publisher-search-page"`


## 2026-10-21 02:45:30 — Before: Build #118 Sources nav link

- **ID**: 2026-10-21_02-36-33_before-build-118-sources-nav-link
- **Reason**: 
- **Repo commit**: 849af95a (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T01-38-15Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_02-36-33_before-build-118-sources-nav-link"`


## 2026-10-21 03:38:38 — Before: Build #119 Africanews publisher

- **ID**: 2026-10-21_03-33-16_before-build-119-africanews-publisher
- **Reason**: 
- **Repo commit**: 9167af98 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T02-34-57Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_03-33-16_before-build-119-africanews-publisher"`


## 2026-10-21 09:55:51 — Before: Build #120 West Africa batch 1 (5 publishers)

- **ID**: 2026-10-21_09-50-37_before-build-120-west-africa-batch-1-5-p
- **Reason**: 
- **Repo commit**: 4fc44815 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T08-52-16Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_09-50-37_before-build-120-west-africa-batch-1-5-p"`


## 2026-10-21 10:41:38 — Before: Build #121 West Africa batch 2 (2 publishers)

- **ID**: 2026-10-21_10-36-32_before-build-121-west-africa-batch-2-2-p
- **Reason**: 
- **Repo commit**: 8343abd7 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T09-38-07Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_10-36-32_before-build-121-west-africa-batch-2-2-p"`


## 2026-10-21 12:12:01 — Before: Build #122 YouTube creator hub

- **ID**: 2026-10-21_12-06-49_before-build-122-youtube-creator-hub
- **Reason**: 
- **Repo commit**: 2b4093aa (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-21T11-08-28Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-21_12-06-49_before-build-122-youtube-creator-hub"`


## 2026-10-29 01:55:25 — Before: Build #122 YouTube creator hub

- **ID**: 2026-10-29_01-51-35_before-build-122-youtube-creator-hub
- **Reason**: 
- **Repo commit**: b553cdae (main)
- **K8s state captured**: False
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-29_01-51-35_before-build-122-youtube-creator-hub"`


## 2026-10-29 02:32:55 — Before: Build #122 YouTube creator hub

- **ID**: 2026-10-29_02-27-10_before-build-122-youtube-creator-hub
- **Reason**: 
- **Repo commit**: b553cdae (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-10-29T02-28-43Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-10-29_02-27-10_before-build-122-youtube-creator-hub"`


## 2026-11-01 23:13:55 — Before: start stopped OKE nodes (OCI mass stop 2026-10-31)

- **ID**: 2026-11-01_23-01-25_before-start-stopped-oke-nodes-oci-mass
- **Reason**: 
- **Repo commit**: 7fe6b034 (main)
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-01_23-01-25_before-start-stopped-oke-nodes-oci-mass"`


## 2026-11-02 11:59:37 — Before: Build #123 East Africa batch 1 (3 publishers)

- **ID**: 2026-11-02_11-54-12_before-build-123-east-africa-batch-1-3-p
- **Reason**: 
- **Repo commit**: 80e52548 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-11-02T11-55-41Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_11-54-12_before-build-123-east-africa-batch-1-3-p"`


## 2026-11-02 12:44:29 — Before: Build #124 North Africa batch 1 (3 publishers)

- **ID**: 2026-11-02_12-39-00_before-build-124-north-africa-batch-1-3
- **Reason**: 
- **Repo commit**: 99c7d846 (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-11-02T12-40-29Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_12-39-00_before-build-124-north-africa-batch-1-3"`


## 2026-11-02 13:31:13 — Before: Build #125 MV + CI sources (4 publishers)

- **ID**: 2026-11-02_13-25-16_before-build-125-mv-ci-sources-4-publish
- **Reason**: 
- **Repo commit**: 6b04fafb (main)
- **K8s state captured**: True
- **DB backup**: nouvellesdupays-db-backups/nouvellesdupays-2026-11-02T13-26-50Z.sql.gz
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_13-25-16_before-build-125-mv-ci-sources-4-publish"`


## 2026-11-02 15:12:41 — Baseline: on-prem tooling test

- **ID**: 2026-11-02_15-08-50_baseline-on-prem-tooling-test
- **Reason**: 
- **Repo commit**: 6755b95a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_15-08-50_baseline-on-prem-tooling-test"`


## 2026-11-02 15:21:59 — Baseline: on-prem tooling test

- **ID**: 2026-11-02_15-18-34_baseline-on-prem-tooling-test
- **Reason**: 
- **Repo commit**: 6755b95a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T15-18-37Z-baseline-on-prem-tooling-test.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_15-18-34_baseline-on-prem-tooling-test"`


## 2026-11-02 16:21:37 — Before: Build #127 on-prem weekly report CronJob

- **ID**: 2026-11-02_16-18-13_before-build-127-on-prem-weekly-report-c
- **Reason**: 
- **Repo commit**: b3cd195a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T16-18-16Z-before-build-127-on-prem-weekly-report-c.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_16-18-13_before-build-127-on-prem-weekly-report-c"`


## 2026-11-02 16:39:38 — Before: Build #128 discovery approvals 1 (12 publishers)

- **ID**: 2026-11-02_16-36-37_before-build-128-discovery-approvals-1-1
- **Reason**: 
- **Repo commit**: 43ddce68 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T16-36-40Z-before-build-128-discovery-approvals-1-1.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_16-36-37_before-build-128-discovery-approvals-1-1"`


## 2026-11-02 17:18:21 — Before: admin login on on-prem production

- **ID**: 2026-11-02_17-15-12_before-admin-login-on-on-prem-production
- **Reason**: 
- **Repo commit**: d2da9916 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T17-15-15Z-before-admin-login-on-on-prem-production.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_17-15-12_before-admin-login-on-on-prem-production"`


## 2026-11-02 17:33:28 — Before: Build #130 approve assigns publisher slug

- **ID**: 2026-11-02_17-30-11_before-build-130-approve-assigns-publish
- **Reason**: 
- **Repo commit**: 18b3476c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T17-30-17Z-before-build-130-approve-assigns-publish.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_17-30-11_before-build-130-approve-assigns-publish"`


## 2026-11-02 19:32:57 — Before: Build 131 Goobjoog feed to news sitemap

- **ID**: 2026-11-02_19-29-26_before-build-131-goobjoog-feed-to-news-s
- **Reason**: 
- **Repo commit**: 058e24d8 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T19-29-30Z-before-build-131-goobjoog-feed-to-news-s.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_19-29-26_before-build-131-goobjoog-feed-to-news-s"`


## 2026-11-02 19:58:09 — Before: add CamboJA News (KH)

- **ID**: 2026-11-02_19-54-46_before-add-camboja-news-kh
- **Reason**: 
- **Repo commit**: 1008aa5a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T19-54-49Z-before-add-camboja-news-kh.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_19-54-46_before-add-camboja-news-kh"`


## 2026-11-02 21:48:15 — Before: add CBC Barbados, The Tribune, ZNS Bahamas

- **ID**: 2026-11-02_21-44-43_before-add-cbc-barbados-the-tribune-zns
- **Reason**: 
- **Repo commit**: 0009ca71 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T21-44-47Z-before-add-cbc-barbados-the-tribune-zns.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_21-44-43_before-add-cbc-barbados-the-tribune-zns"`


## 2026-11-02 22:35:59 — Before: profile accent repair + Build 133 West Africa sources

- **ID**: 2026-11-02_22-32-27_before-profile-accent-repair-build-133-w
- **Reason**: 
- **Repo commit**: be568a7f (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T22-32-31Z-before-profile-accent-repair-build-133-w.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_22-32-27_before-profile-accent-repair-build-133-w"`


## 2026-11-02 23:35:09 — Before: Build 134 six West African publishers

- **ID**: 2026-11-02_23-32-12_before-build-134-six-west-african-publis
- **Reason**: 
- **Repo commit**: 372ae587 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-02T23-32-15Z-before-build-134-six-west-african-publis.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-02_23-32-12_before-build-134-six-west-african-publis"`


## 2026-11-03 00:18:27 — Before: Build 135 seven publishers for stale African countries

- **ID**: 2026-11-03_00-14-57_before-build-135-seven-publishers-for-st
- **Reason**: 
- **Repo commit**: 2414b482 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T00-15-01Z-before-build-135-seven-publishers-for-st.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_00-14-57_before-build-135-seven-publishers-for-st"`


## 2026-11-03 00:59:14 — Before: Build 136 slug fix + worker error-cause logging (image rebuild)

- **ID**: 2026-11-03_00-56-07_before-build-136-slug-fix-worker-error-c
- **Reason**: 
- **Repo commit**: 15fe0ea7 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T00-56-10Z-before-build-136-slug-fix-worker-error-c.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_00-56-07_before-build-136-slug-fix-worker-error-c"`


## 2026-11-03 01:11:52 — Before: Build 137 eight publishers for thin African countries

- **ID**: 2026-11-03_01-08-20_before-build-137-eight-publishers-for-th
- **Reason**: 
- **Repo commit**: 15fe0ea7 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T01-08-24Z-before-build-137-eight-publishers-for-th.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_01-08-20_before-build-137-eight-publishers-for-th"`


## 2026-11-03 11:53:32 — Before: Build 138 worker connect attempt timeout 2.5s

- **ID**: 2026-11-03_11-50-04_before-build-138-worker-connect-attempt
- **Reason**: 
- **Repo commit**: e4837d1b (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T11-50-07Z-before-build-138-worker-connect-attempt.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_11-50-04_before-build-138-worker-connect-attempt"`


## 2026-11-03 17:13:42 — Before: Build 139 worker CronJobs imagePullPolicy Always

- **ID**: 2026-11-03_17-09-59_before-build-139-worker-cronjobs-imagepu
- **Reason**: 
- **Repo commit**: e0a17434 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T17-10-04Z-before-build-139-worker-cronjobs-imagepu.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_17-09-59_before-build-139-worker-cronjobs-imagepu"`


## 2026-11-03 19:42:40 — Before: Build 140 add Capital News GW

- **ID**: 2026-11-03_19-38-42_before-build-140-add-capital-news-gw
- **Reason**: 
- **Repo commit**: 6a60637c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T19-38-45Z-before-build-140-add-capital-news-gw.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_19-38-42_before-build-140-add-capital-news-gw"`


## 2026-11-03 20:20:33 — Before: Build 141 add 13 African publishers

- **ID**: 2026-11-03_20-17-20_before-build-141-add-13-african-publishe
- **Reason**: 
- **Repo commit**: 6a60637c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T20-17-24Z-before-build-141-add-13-african-publishe.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_20-17-20_before-build-141-add-13-african-publishe"`


## 2026-11-03 20:39:39 — Before: Build 142 add 8 African publishers

- **ID**: 2026-11-03_20-36-08_before-build-142-add-8-african-publisher
- **Reason**: 
- **Repo commit**: 6a60637c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T20-36-11Z-before-build-142-add-8-african-publisher.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_20-36-08_before-build-142-add-8-african-publisher"`


## 2026-11-03 21:35:30 — Before: Build 143 add 8 African publishers

- **ID**: 2026-11-03_21-31-50_before-build-143-add-8-african-publisher
- **Reason**: 
- **Repo commit**: e9010c3e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T21-31-53Z-before-build-143-add-8-african-publisher.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_21-31-50_before-build-143-add-8-african-publisher"`


## 2026-11-03 21:55:54 — Before: Build 144 Middle East 13 publishers + Arab News revive

- **ID**: 2026-11-03_21-52-33_before-build-144-middle-east-13-publishe
- **Reason**: 
- **Repo commit**: 8502dcb3 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T21-52-37Z-before-build-144-middle-east-13-publishe.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_21-52-33_before-build-144-middle-east-13-publishe"`


## 2026-11-03 22:23:57 — Before: Build 145 add 20 Americas-Pacific publishers

- **ID**: 2026-11-03_22-20-30_before-build-145-add-20-americas-pacific
- **Reason**: 
- **Repo commit**: bad32081 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-03T22-20-34Z-before-build-145-add-20-americas-pacific.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-03_22-20-30_before-build-145-add-20-americas-pacific"`


## 2026-11-04 00:59:31 — Before: Build #146 add 16 Asia-South America publishers

- **ID**: 2026-11-04_00-56-01_before-build-146-add-16-asia-south-ameri
- **Reason**: 
- **Repo commit**: 3ee127dc (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T00-56-05Z-before-build-146-add-16-asia-south-ameri.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_00-56-01_before-build-146-add-16-asia-south-ameri"`


## 2026-11-04 01:14:13 — Before: Build #147 add 24 Eurasia-Canada publishers

- **ID**: 2026-11-04_01-10-20_before-build-147-add-24-eurasia-canada-p
- **Reason**: 
- **Repo commit**: a3027f0a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T01-10-25Z-before-build-147-add-24-eurasia-canada-p.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_01-10-20_before-build-147-add-24-eurasia-canada-p"`


## 2026-11-04 12:26:47 — Before: Build #148 add 34 Europe-Middle East publishers

- **ID**: 2026-11-04_12-23-13_before-build-148-add-34-europe-middle-ea
- **Reason**: 
- **Repo commit**: 573597c8 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T12-23-16Z-before-build-148-add-34-europe-middle-ea.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_12-23-13_before-build-148-add-34-europe-middle-ea"`


## 2026-11-04 15:08:18 — Before: Build 149 IIS stopgap rewrite .50 to .51

- **ID**: 2026-11-04_15-03-02_before-build-149-iis-stopgap-rewrite-50
- **Reason**: 
- **Repo commit**: 26db9ba9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T15-03-08Z-before-build-149-iis-stopgap-rewrite-50.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_15-03-02_before-build-149-iis-stopgap-rewrite-50"`


## 2026-11-04 17:20:23 — Before: Build 150 add 19 LatAm-Asia publishers

- **ID**: 2026-11-04_17-15-14_before-build-150-add-19-latam-asia-publi
- **Reason**: 
- **Repo commit**: e32eebe5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T17-15-18Z-before-build-150-add-19-latam-asia-publi.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_17-15-14_before-build-150-add-19-latam-asia-publi"`


## 2026-11-04 19:05:25 — Before: Build 151 add Namibian Sun

- **ID**: 2026-11-04_19-02-11_before-build-151-add-namibian-sun
- **Reason**: 
- **Repo commit**: 6eeac47e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T19-02-16Z-before-build-151-add-namibian-sun.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_19-02-11_before-build-151-add-namibian-sun"`


## 2026-11-04 22:57:46 — Before: Build 152 add Tchad Vision

- **ID**: 2026-11-04_22-54-11_before-build-152-add-tchad-vision
- **Reason**: 
- **Repo commit**: 6eeac47e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-04T22-54-15Z-before-build-152-add-tchad-vision.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-04_22-54-11_before-build-152-add-tchad-vision"`


## 2026-11-05 00:15:42 — Before: Build 153 add Al Roya and Kaniva Tonga

- **ID**: 2026-11-05_00-11-46_before-build-153-add-al-roya-and-kaniva
- **Reason**: 
- **Repo commit**: bbc129a7 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T00-11-54Z-before-build-153-add-al-roya-and-kaniva.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_00-11-46_before-build-153-add-al-roya-and-kaniva"`


## 2026-11-05 01:05:41 — Before: Build 154 add Le Point Sur

- **ID**: 2026-11-05_01-01-07_before-build-154-add-le-point-sur
- **Reason**: 
- **Repo commit**: 257302c9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T01-01-21Z-before-build-154-add-le-point-sur.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_01-01-07_before-build-154-add-le-point-sur"`


## 2026-11-05 02:00:16 — Before: Build 155 suspend duplicate OKE silent-report CronJob

- **ID**: 2026-11-05_01-56-19_before-build-155-suspend-duplicate-oke-s
- **Reason**: 
- **Repo commit**: 9a4f9ac5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T01-56-26Z-before-build-155-suspend-duplicate-oke-s.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_01-56-19_before-build-155-suspend-duplicate-oke-s"`


## 2026-11-05 02:23:01 — Before: Build 156 delete evicted pods and old failed Jobs on-prem

- **ID**: 2026-11-05_02-18-50_before-build-156-delete-evicted-pods-and
- **Reason**: 
- **Repo commit**: 8d83b45f (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T02-18-57Z-before-build-156-delete-evicted-pods-and.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_02-18-50_before-build-156-delete-evicted-pods-and"`


## 2026-11-05 02:34:08 — Before: Build 157 add The Standard VnEconomy Prachachat

- **ID**: 2026-11-05_02-29-53_before-build-157-add-the-standard-vnecon
- **Reason**: 
- **Repo commit**: f8e02bd8 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T02-29-58Z-before-build-157-add-the-standard-vnecon.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_02-29-53_before-build-157-add-the-standard-vnecon"`


## 2026-11-05 02:57:57 — Before: Build 158 add Catholic Radio Network and Global Times SL

- **ID**: 2026-11-05_02-54-15_before-build-158-add-catholic-radio-netw
- **Reason**: 
- **Repo commit**: 26cbb2db (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T02-54-21Z-before-build-158-add-catholic-radio-netw.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_02-54-15_before-build-158-add-catholic-radio-netw"`


## 2026-11-05 03:40:51 — Before: Build 159 worker per-feed parser and exclude_title_pattern

- **ID**: 2026-11-05_03-37-00_before-build-159-worker-per-feed-parser
- **Reason**: 
- **Repo commit**: 615b532d (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T03-37-09Z-before-build-159-worker-per-feed-parser.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_03-37-00_before-build-159-worker-per-feed-parser"`


## 2026-11-05 04:32:20 — Before: Build 160 cleanup misfiled and spam articles

- **ID**: 2026-11-05_04-25-58_before-build-160-cleanup-misfiled-and-sp
- **Reason**: 
- **Repo commit**: c3762670 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T04-26-21Z-before-build-160-cleanup-misfiled-and-sp.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_04-25-58_before-build-160-cleanup-misfiled-and-sp"`


## 2026-11-05 11:14:20 — Before: Build #161 add 3 publishers BW-CF

- **ID**: 2026-11-05_11-11-05_before-build-161-add-3-publishers-bw-cf
- **Reason**: 
- **Repo commit**: 5b8ef791 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T11-11-10Z-before-build-161-add-3-publishers-bw-cf.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_11-11-05_before-build-161-add-3-publishers-bw-cf"`


## 2026-11-05 11:29:05 — Before: Build #162 add 5 publishers ST-KM-GQ-SZ-DJ

- **ID**: 2026-11-05_11-25-32_before-build-162-add-5-publishers-st-km
- **Reason**: 
- **Repo commit**: ee15c8c5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T11-25-36Z-before-build-162-add-5-publishers-st-km.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_11-25-32_before-build-162-add-5-publishers-st-km"`


## 2026-11-05 11:43:31 — Before: Build #163 recover Radio Macuto

- **ID**: 2026-11-05_11-39-55_before-build-163-recover-radio-macuto
- **Reason**: 
- **Repo commit**: 17b85b83 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T11-39-58Z-before-build-163-recover-radio-macuto.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_11-39-55_before-build-163-recover-radio-macuto"`


## 2026-11-05 12:03:41 — Before: Build #164 recover Botswana Unplugged

- **ID**: 2026-11-05_11-59-57_before-build-164-recover-botswana-unplug
- **Reason**: 
- **Repo commit**: e458a94b (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T12-00-01Z-before-build-164-recover-botswana-unplug.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_11-59-57_before-build-164-recover-botswana-unplug"`


## 2026-11-05 12:09:21 — Before: Build #165 day-first feed dates

- **ID**: 2026-11-05_12-06-15_before-build-165-day-first-feed-dates
- **Reason**: 
- **Repo commit**: e458a94b (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T12-06-21Z-before-build-165-day-first-feed-dates.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_12-06-15_before-build-165-day-first-feed-dates"`


## 2026-11-05 12:29:57 — Before: Builds 166-167 KH publisher and park broken feeds

- **ID**: 2026-11-05_12-26-15_before-builds-166-167-kh-publisher-and-p
- **Reason**: 
- **Repo commit**: fcda7f3d (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T12-26-19Z-before-builds-166-167-kh-publisher-and-p.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_12-26-15_before-builds-166-167-kh-publisher-and-p"`


## 2026-11-05 13:03:51 — Before: classifier window - Get-ChangeRisk word-start matching

- **ID**: 2026-11-05_13-00-12_before-classifier-window-get-changerisk
- **Reason**: 
- **Repo commit**: 02864ae4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T13-00-19Z-before-classifier-window-get-changerisk.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_13-00-12_before-classifier-window-get-changerisk"`


## 2026-11-05 13:21:31 — Before: Build 166 Ada Derana dates and 4 publishers LK PS JO

- **ID**: 2026-11-05_13-17-55_before-build-166-ada-derana-dates-and-4
- **Reason**: 
- **Repo commit**: 6e23a675 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T13-17-58Z-before-build-166-ada-derana-dates-and-4.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_13-17-55_before-build-166-ada-derana-dates-and-4"`


## 2026-11-05 14:29:38 — Before: Build 167 add 3 publishers BT LU

- **ID**: 2026-11-05_14-26-26_before-build-167-add-3-publishers-bt-lu
- **Reason**: 
- **Repo commit**: d74e8bde (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T14-26-30Z-before-build-167-add-3-publishers-bt-lu.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_14-26-26_before-build-167-add-3-publishers-bt-lu"`


## 2026-11-05 14:40:29 — Before: Build 168 add 9 publishers large countries

- **ID**: 2026-11-05_14-37-15_before-build-168-add-9-publishers-large
- **Reason**: 
- **Repo commit**: e7841086 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T14-37-18Z-before-build-168-add-9-publishers-large.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_14-37-15_before-build-168-add-9-publishers-large"`


## 2026-11-05 15:58:38 — Before: Build #169 add 9 RSS publishers for PL, NL, GR, HU, RO, FI, NO, DK, PT

- **ID**: 2026-11-05_15-54-50_before-build-169-add-9-rss-publishers-fo
- **Reason**: 
- **Repo commit**: be0698a1 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T15-54-54Z-before-build-169-add-9-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_15-54-50_before-build-169-add-9-rss-publishers-fo"`


## 2026-11-05 16:13:55 — Before: Dagbladet undated fetch_time fix

- **ID**: 2026-11-05_16-09-49_before-dagbladet-undated-fetch-time-fix
- **Reason**: 
- **Repo commit**: e2e1e864 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T16-09-53Z-before-dagbladet-undated-fetch-time-fix.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_16-09-49_before-dagbladet-undated-fetch-time-fix"`


## 2026-11-05 16:50:19 — Before: worker CDATA headline and feed charset fix

- **ID**: 2026-11-05_16-47-00_before-worker-cdata-headline-and-feed-ch
- **Reason**: 
- **Repo commit**: e12418f6 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T16-47-04Z-before-worker-cdata-headline-and-feed-ch.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_16-47-00_before-worker-cdata-headline-and-feed-ch"`


## 2026-11-05 17:09:09 — Before: Build #171 add 3 RSS publishers for SC and ER

- **ID**: 2026-11-05_17-05-36_before-build-171-add-3-rss-publishers-fo
- **Reason**: 
- **Repo commit**: 4f85b406 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T17-05-41Z-before-build-171-add-3-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_17-05-36_before-build-171-add-3-rss-publishers-fo"`


## 2026-11-05 17:24:09 — Before: Build #172 add 3 RSS publishers for MU and MG

- **ID**: 2026-11-05_17-20-51_before-build-172-add-3-rss-publishers-fo
- **Reason**: 
- **Repo commit**: 9c276870 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T17-20-54Z-before-build-172-add-3-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_17-20-51_before-build-172-add-3-rss-publishers-fo"`


## 2026-11-05 18:58:49 — Before: Build #173 add 6 RSS publishers for IQ, ME, LA, PG

- **ID**: 2026-11-05_18-55-15_before-build-173-add-6-rss-publishers-fo
- **Reason**: 
- **Repo commit**: c752a142 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T18-55-19Z-before-build-173-add-6-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_18-55-15_before-build-173-add-6-rss-publishers-fo"`


## 2026-11-05 19:20:57 — Before: Build #174 add 13 RSS publishers for BE, BG, SG, TW, IR, BD, NZ, IL

- **ID**: 2026-11-05_19-17-34_before-build-174-add-13-rss-publishers-f
- **Reason**: 
- **Repo commit**: 497b0bf5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T19-17-37Z-before-build-174-add-13-rss-publishers-f.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_19-17-34_before-build-174-add-13-rss-publishers-f"`


## 2026-11-05 19:36:50 — Before: BBC Persian undated fetch_time fix

- **ID**: 2026-11-05_19-33-15_before-bbc-persian-undated-fetch-time-fi
- **Reason**: 
- **Repo commit**: 4ac1e2f9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T19-33-20Z-before-bbc-persian-undated-fetch-time-fi.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_19-33-15_before-bbc-persian-undated-fetch-time-fi"`


## 2026-11-05 19:48:54 — Before: Build #176 add 8 RSS publishers for HK, BY, AZ, LT, AE, LB

- **ID**: 2026-11-05_19-45-22_before-build-176-add-8-rss-publishers-fo
- **Reason**: 
- **Repo commit**: 0dc408b5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T19-45-27Z-before-build-176-add-8-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_19-45-22_before-build-176-add-8-rss-publishers-fo"`


## 2026-11-05 20:08:56 — Before: Build #177 add 7 RSS publishers for CR, CU, PY, PA, UY

- **ID**: 2026-11-05_20-05-24_before-build-177-add-7-rss-publishers-fo
- **Reason**: 
- **Repo commit**: f591fd39 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T20-05-29Z-before-build-177-add-7-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_20-05-24_before-build-177-add-7-rss-publishers-fo"`


## 2026-11-05 20:43:02 — Before: Build #178 add 11 RSS publishers for BZ, SR, MM, GY, TJ, TM, MK, SB

- **ID**: 2026-11-05_20-39-25_before-build-178-add-11-rss-publishers-f
- **Reason**: 
- **Repo commit**: 7e9532d0 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T20-39-28Z-before-build-178-add-11-rss-publishers-f.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_20-39-25_before-build-178-add-11-rss-publishers-f"`


## 2026-11-05 21:04:37 — Before: Build #179 add 3 RSS publishers for LI, WS, TO

- **ID**: 2026-11-05_21-01-29_before-build-179-add-3-rss-publishers-fo
- **Reason**: 
- **Repo commit**: b7436213 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T21-01-32Z-before-build-179-add-3-rss-publishers-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_21-01-29_before-build-179-add-3-rss-publishers-fo"`


## 2026-11-05 22:07:27 — Before: park 16 blocked publishers and disable 2 broken extra feeds

- **ID**: 2026-11-05_22-03-48_before-park-16-blocked-publishers-and-di
- **Reason**: 
- **Repo commit**: 23c02784 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T22-03-52Z-before-park-16-blocked-publishers-and-di.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_22-03-48_before-park-16-blocked-publishers-and-di"`


## 2026-11-05 22:52:45 — Before: Build #181 add 3 news-sitemap publishers for EC, MV, AE

- **ID**: 2026-11-05_22-49-13_before-build-181-add-3-news-sitemap-publ
- **Reason**: 
- **Repo commit**: bb9f5a4a (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T22-49-17Z-before-build-181-add-3-news-sitemap-publ.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_22-49-13_before-build-181-add-3-news-sitemap-publ"`


## 2026-11-05 23:25:02 — Before: early worker image build (day_first, charset, accept_encoding); rollback image tag rollback-ed2b779f

- **ID**: 2026-11-05_23-21-52_before-early-worker-image-build-day-firs
- **Reason**: 
- **Repo commit**: e3938ec2 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T23-21-55Z-before-early-worker-image-build-day-firs.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_23-21-52_before-early-worker-image-build-day-firs"`


## 2026-11-05 23:37:49 — Before: Depeches de Brazzaville and En Segundos data steps

- **ID**: 2026-11-05_23-34-07_before-depeches-de-brazzaville-and-en-se
- **Reason**: 
- **Repo commit**: e3938ec2 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-05T23-34-10Z-before-depeches-de-brazzaville-and-en-se.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-05_23-34-07_before-depeches-de-brazzaville-and-en-se"`


## 2026-11-06 00:20:49 — Before: clean up broken-accent duplicates and Correio CDATA headlines

- **ID**: 2026-11-06_00-17-18_before-clean-up-broken-accent-duplicates
- **Reason**: 
- **Repo commit**: 43d2f14b (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-06T00-17-24Z-before-clean-up-broken-accent-duplicates.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-06_00-17-18_before-clean-up-broken-accent-duplicates"`


## 2026-11-06 00:38:53 — Before: La Tercera section feed and TamTamInfo unavailable

- **ID**: 2026-11-06_00-35-27_before-la-tercera-section-feed-and-tamta
- **Reason**: 
- **Repo commit**: 368b2cc5 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-06T00-35-36Z-before-la-tercera-section-feed-and-tamta.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-06_00-35-27_before-la-tercera-section-feed-and-tamta"`


## 2026-11-06 16:04:10 — Before: Build 185 delete 6 spam articles + Leadership/Bhutan title filters

- **ID**: 2026-11-06_16-00-12_before-build-185-delete-6-spam-articles
- **Reason**: 
- **Repo commit**: 0cc60694 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-06T16-00-16Z-before-build-185-delete-6-spam-articles.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-06_16-00-12_before-build-185-delete-6-spam-articles"`


## 2026-11-06 23:59:10 — Before: Build 186 index articles publisher_id md5 original_url

- **ID**: 2026-11-06_23-55-47_before-build-186-index-articles-publishe
- **Reason**: 
- **Repo commit**: ee5b8aa0 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-06T23-55-51Z-before-build-186-index-articles-publishe.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-06_23-55-47_before-build-186-index-articles-publishe"`


## 2026-11-07 00:10:56 — Before: Build 187 delete headline-edit duplicate copies (30 days)

- **ID**: 2026-11-07_00-07-22_before-build-187-delete-headline-edit-du
- **Reason**: 
- **Repo commit**: 2e785f43 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-07T00-07-25Z-before-build-187-delete-headline-edit-du.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-07_00-07-22_before-build-187-delete-headline-edit-du"`


## 2026-11-07 00:33:50 — Before: Build 188 worker deploy applyHeadlineEdits; rollback image tag rollback-e70b019e

- **ID**: 2026-11-07_00-30-11_before-build-188-worker-deploy-applyhead
- **Reason**: 
- **Repo commit**: 2e785f43 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-07T00-30-15Z-before-build-188-worker-deploy-applyhead.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-07_00-30-11_before-build-188-worker-deploy-applyhead"`


## 2026-11-07 00:47:43 — Before: Build 189 delete 68 leftover duplicate copies

- **ID**: 2026-11-07_00-44-02_before-build-189-delete-68-leftover-dupl
- **Reason**: 
- **Repo commit**: 82e45810 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-07T00-44-06Z-before-build-189-delete-68-leftover-dupl.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-07_00-44-02_before-build-189-delete-68-leftover-dupl"`


## 2026-11-07 17:53:27 — Before: Build 190 delete 2 Bhutan spam articles and widen feed 1020 filter

- **ID**: 2026-11-07_17-49-47_before-build-190-delete-2-bhutan-spam-ar
- **Reason**: 
- **Repo commit**: dae47beb (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-07T17-49-53Z-before-build-190-delete-2-bhutan-spam-ar.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-07_17-49-47_before-build-190-delete-2-bhutan-spam-ar"`


## 2026-11-07 18:31:50 — Before: Build 191 reject 8 discovery candidates

- **ID**: 2026-11-07_18-28-27_before-build-191-reject-8-discovery-cand
- **Reason**: 
- **Repo commit**: fdbfe9d4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-07T18-28-31Z-before-build-191-reject-8-discovery-cand.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-07_18-28-27_before-build-191-reject-8-discovery-cand"`


## 2026-11-08 03:56:52 — Before: Build 192 reject 4 discovery candidates

- **ID**: 2026-11-08_03-53-25_before-build-192-reject-4-discovery-cand
- **Reason**: 
- **Repo commit**: 75be71da (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T03-53-27Z-before-build-192-reject-4-discovery-cand.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_03-53-25_before-build-192-reject-4-discovery-cand"`


## 2026-11-08 12:30:15 — Before: Build 193 delete 3 Bhutan spam-account rows and add bet to feed 1020 filter

- **ID**: 2026-11-08_12-27-11_before-build-193-delete-3-bhutan-spam-ac
- **Reason**: 
- **Repo commit**: 1a93478e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T12-27-16Z-before-build-193-delete-3-bhutan-spam-ac.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_12-27-11_before-build-193-delete-3-bhutan-spam-ac"`


## 2026-11-08 12:42:22 — Before: Build 194 add UzA and Bernama, reject 4 discovery candidates

- **ID**: 2026-11-08_12-38-43_before-build-194-add-uza-and-bernama-rej
- **Reason**: 
- **Repo commit**: 62376348 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T12-38-50Z-before-build-194-add-uza-and-bernama-rej.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_12-38-43_before-build-194-add-uza-and-bernama-rej"`


## 2026-11-08 14:23:24 — Before: Build #195 worker image 93fc5cb (only_authors allowlist)

- **ID**: 2026-11-08_14-19-33_before-build-195-worker-image-93fc5cb-on
- **Reason**: 
- **Repo commit**: 93fc5cb8 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T14-19-39Z-before-build-195-worker-image-93fc5cb-on.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_14-19-33_before-build-195-worker-image-93fc5cb-on"`


## 2026-11-08 14:35:50 — Before: Build #196 feed 1020 only_authors businessbhutan

- **ID**: 2026-11-08_14-32-32_before-build-196-feed-1020-only-authors
- **Reason**: 
- **Repo commit**: 5d7e9247 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T14-32-36Z-before-build-196-feed-1020-only-authors.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_14-32-32_before-build-196-feed-1020-only-authors"`


## 2026-11-08 15:10:18 — Before: Kigali Today worker parse retry (branch)

- **ID**: 2026-11-08_15-07-05_before-kigali-today-worker-parse-retry-b
- **Reason**: 
- **Repo commit**: c8a17818 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T15-07-10Z-before-kigali-today-worker-parse-retry-b.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_15-07-05_before-kigali-today-worker-parse-retry-b"`


## 2026-11-08 15:34:15 — Before: Build #197 worker image 0844c6d (Kigali Today parse retry)

- **ID**: 2026-11-08_15-30-44_before-build-197-worker-image-0844c6d-ki
- **Reason**: 
- **Repo commit**: 0844c6d9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T15-30-49Z-before-build-197-worker-image-0844c6d-ki.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_15-30-44_before-build-197-worker-image-0844c6d-ki"`


## 2026-11-08 15:59:02 — Before: Build #198 Prensa Libre feed 1515 to news sitemap

- **ID**: 2026-11-08_15-55-33_before-build-198-prensa-libre-feed-1515
- **Reason**: 
- **Repo commit**: 4dd65fef (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T15-55-37Z-before-build-198-prensa-libre-feed-1515.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_15-55-33_before-build-198-prensa-libre-feed-1515"`


## 2026-11-08 20:54:51 — Before: Build #199 Global Times feed 963 to news sitemap

- **ID**: 2026-11-08_20-51-27_before-build-199-global-times-feed-963-t
- **Reason**: 
- **Repo commit**: 820c66e9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T20-51-31Z-before-build-199-global-times-feed-963-t.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_20-51-27_before-build-199-global-times-feed-963-t"`


## 2026-11-08 21:09:46 — Before: Build #200 KOACI feed 7292 to html crawl

- **ID**: 2026-11-08_21-06-30_before-build-200-koaci-feed-7292-to-html
- **Reason**: 
- **Repo commit**: 4a996de1 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-08T21-06-34Z-before-build-200-koaci-feed-7292-to-html.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_21-06-30_before-build-200-koaci-feed-7292-to-html"`


## 2026-11-08 22:36:11 — Before: Build #201 KOACI backlog published_at correction (47 rows, feed 7292)

- **ID**: 2026-11-08_22-19-07_before-build-201-koaci-backlog-published
- **Reason**: 
- **Repo commit**: 03219a77 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: SKIPPED (no cluster/oci access this run)
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-08_22-19-07_before-build-201-koaci-backlog-published"`


## 2026-11-09 01:09:54 — Before: Build #201 KOACI backlog published_at correction (47 rows, feed 7292) retry

- **ID**: 2026-11-09_01-06-43_before-build-201-koaci-backlog-published
- **Reason**: 
- **Repo commit**: 03219a77 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T01-06-46Z-before-build-201-koaci-backlog-published.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_01-06-43_before-build-201-koaci-backlog-published"`


## 2026-11-09 11:37:18 — Before: Build #202 ops scripts keep DB password off the command line

- **ID**: 2026-11-09_11-33-36_before-build-202-ops-scripts-keep-db-pas
- **Reason**: 
- **Repo commit**: f71f88f4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T11-33-43Z-before-build-202-ops-scripts-keep-db-pas.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_11-33-36_before-build-202-ops-scripts-keep-db-pas"`


## 2026-11-09 11:42:57 — Build #202 check: dump with password off the command line

- **ID**: 2026-11-09_11-39-14_build-202-check-dump-with-password-off-t
- **Reason**: 
- **Repo commit**: f71f88f4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T11-39-17Z-build-202-check-dump-with-password-off-t.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_11-39-14_build-202-check-dump-with-password-off-t"`


## 2026-11-09 12:19:58 — Before: Build #203 RTB feed 8921 to its RSS

- **ID**: 2026-11-09_12-16-35_before-build-203-rtb-feed-8921-to-its-rs
- **Reason**: 
- **Repo commit**: 22624da2 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T12-16-38Z-before-build-203-rtb-feed-8921-to-its-rs.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_12-16-35_before-build-203-rtb-feed-8921-to-its-rs"`


## 2026-11-09 12:39:52 — Before: Build #204 reactivate RTB publisher 8923

- **ID**: 2026-11-09_12-36-24_before-build-204-reactivate-rtb-publishe
- **Reason**: 
- **Repo commit**: 339efce4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T12-36-27Z-before-build-204-reactivate-rtb-publishe.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_12-36-24_before-build-204-reactivate-rtb-publishe"`


## 2026-11-09 16:39:47 — Before: Build #205 on-prem restore path in Invoke-Rollback

- **ID**: 2026-11-09_16-35-12_before-build-205-on-prem-restore-path-in
- **Reason**: 
- **Repo commit**: 7eb95978 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T16-35-18Z-before-build-205-on-prem-restore-path-in.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_16-35-12_before-build-205-on-prem-restore-path-in"`


## 2026-11-09 17:34:49 — Before: Build #206 rotate on-prem DB app password

- **ID**: 2026-11-09_17-31-00_before-build-206-rotate-on-prem-db-app-p
- **Reason**: 
- **Repo commit**: 6c281356 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T17-31-02Z-before-build-206-rotate-on-prem-db-app-p.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_17-31-00_before-build-206-rotate-on-prem-db-app-p"`


## 2026-11-09 19:58:48 — After: Build #206 DB password rotated (dump with new password)

- **ID**: 2026-11-09_19-55-11_after-build-206-db-password-rotated-dump
- **Reason**: 
- **Repo commit**: 6c281356 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-09T19-55-14Z-after-build-206-db-password-rotated-dump.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-09_19-55-11_after-build-206-db-password-rotated-dump"`


## 2026-11-10 00:24:49 — Before: Build #207 suspend Notre Voie publisher 8894 and disable feed 8892

- **ID**: 2026-11-10_00-21-08_before-build-207-suspend-notre-voie-publ
- **Reason**: 
- **Repo commit**: 54349880 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-10T00-21-12Z-before-build-207-suspend-notre-voie-publ.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-10_00-21-08_before-build-207-suspend-notre-voie-publ"`


## 2026-11-10 00:38:03 — Before: rolling restart of nouvellesdupays-web (Build #207 stale source page)

- **ID**: 2026-11-10_00-34-24_before-rolling-restart-of-nouvellesdupay
- **Reason**: 
- **Repo commit**: b6e90e44 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-10T00-34-27Z-before-rolling-restart-of-nouvellesdupay.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-10_00-34-24_before-rolling-restart-of-nouvellesdupay"`


## 2026-11-10 00:47:15 — Before: Build #208 web source pages uncached (54246a6)

- **ID**: 2026-11-10_00-43-23_before-build-208-web-source-pages-uncach
- **Reason**: 
- **Repo commit**: 54246a6f (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-10T00-43-27Z-before-build-208-web-source-pages-uncach.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-10_00-43-23_before-build-208-web-source-pages-uncach"`


## 2026-11-10 01:13:45 — Before: Build #209 disable frozen NNA RSS feed 9050

- **ID**: 2026-11-10_01-10-25_before-build-209-disable-frozen-nna-rss
- **Reason**: 
- **Repo commit**: 996dfbf9 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-10T01-10-30Z-before-build-209-disable-frozen-nna-rss.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-10_01-10-25_before-build-209-disable-frozen-nna-rss"`


## 2026-11-10 01:33:20 — Before: Build #210 six stale feeds to new URLs, NHK feed disabled

- **ID**: 2026-11-10_01-29-21_before-build-210-six-stale-feeds-to-new
- **Reason**: 
- **Repo commit**: 9a6e8e48 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-10T01-29-24Z-before-build-210-six-stale-feeds-to-new.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-10_01-29-21_before-build-210-six-stale-feeds-to-new"`


## 2026-11-11 00:53:54 — Before: Build #211 pg Pool error handler (shared db.js)

- **ID**: 2026-11-11_00-50-00_before-build-211-pg-pool-error-handler-s
- **Reason**: 
- **Repo commit**: 0a24e95c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T00-50-05Z-before-build-211-pg-pool-error-handler-s.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_00-50-00_before-build-211-pg-pool-error-handler-s"`


## 2026-11-11 01:20:51 — Before: Build #212 disable Le Mauricien duplicate feed 9263

- **ID**: 2026-11-11_01-17-18_before-build-212-disable-le-mauricien-du
- **Reason**: 
- **Repo commit**: da0a3525 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T01-17-23Z-before-build-212-disable-le-mauricien-du.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_01-17-18_before-build-212-disable-le-mauricien-du"`


## 2026-11-11 01:50:00 — Before: Build #213 AllAfrica Mauritania to French feed

- **ID**: 2026-11-11_01-46-39_before-build-213-allafrica-mauritania-to
- **Reason**: 
- **Repo commit**: ffce91c0 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T01-46-43Z-before-build-213-allafrica-mauritania-to.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_01-46-39_before-build-213-allafrica-mauritania-to"`


## 2026-11-11 02:09:10 — Before: Build #214 creator directory schema (migration 018)

- **ID**: 2026-11-11_02-05-28_before-build-214-creator-directory-schem
- **Reason**: 
- **Repo commit**: d1f22614 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T02-05-35Z-before-build-214-creator-directory-schem.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_02-05-28_before-build-214-creator-directory-schem"`


## 2026-11-11 02:57:12 — Before: Build #215 creator review queue (admin API + /admin/creators)

- **ID**: 2026-11-11_02-53-15_before-build-215-creator-review-queue-ad
- **Reason**: 
- **Repo commit**: 46faa093 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T02-53-19Z-before-build-215-creator-review-queue-ad.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_02-53-15_before-build-215-creator-review-queue-ad"`


## 2026-11-11 04:16:24 — Before: Build #216 audience values as JSON numbers

- **ID**: 2026-11-11_04-12-26_before-build-216-audience-values-as-json
- **Reason**: 
- **Repo commit**: 271c8d99 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T04-12-30Z-before-build-216-audience-values-as-json.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_04-12-26_before-build-216-audience-values-as-json"`


## 2026-11-11 04:59:26 — Before: Build #217 creator agents worker job + CronJob

- **ID**: 2026-11-11_04-55-23_before-build-217-creator-agents-worker-j
- **Reason**: 
- **Repo commit**: 5ad86427 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T04-55-27Z-before-build-217-creator-agents-worker-j.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_04-55-23_before-build-217-creator-agents-worker-j"`


## 2026-11-11 05:37:34 — Before: Build #218 YOUTUBE_API_KEY env on the API deployment

- **ID**: 2026-11-11_05-33-28_before-build-218-youtube-api-key-env-on
- **Reason**: 
- **Repo commit**: 9382d4f3 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T05-33-32Z-before-build-218-youtube-api-key-env-on.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_05-33-28_before-build-218-youtube-api-key-env-on"`


## 2026-11-11 05:58:52 — Before: Build #219 suspend Liechtenstein-Journal

- **ID**: 2026-11-11_05-55-13_before-build-219-suspend-liechtenstein-j
- **Reason**: 
- **Repo commit**: 4cf3d610 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T05-55-17Z-before-build-219-suspend-liechtenstein-j.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_05-55-13_before-build-219-suspend-liechtenstein-j"`


## 2026-11-11 06:26:53 — Before: Build #218 YOUTUBE_API_KEY on the API deployment (window 2)

- **ID**: 2026-11-11_06-22-41_before-build-218-youtube-api-key-on-the
- **Reason**: 
- **Repo commit**: 7c6ee61c (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T06-22-45Z-before-build-218-youtube-api-key-on-the.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_06-22-41_before-build-218-youtube-api-key-on-the"`


## 2026-11-11 07:47:42 — Before: Build #221 YouTube discovery search v2

- **ID**: 2026-11-11_07-43-32_before-build-221-youtube-discovery-searc
- **Reason**: 
- **Repo commit**: fc5e2b74 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T07-43-36Z-before-build-221-youtube-discovery-searc.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_07-43-32_before-build-221-youtube-discovery-searc"`


## 2026-11-11 10:49:45 — Before: Build #220 turn off 4 robots whole-site-blocked feeds (268, 627, 967, 1064)

- **ID**: 2026-11-11_10-46-06_before-build-220-turn-off-4-robots-whole
- **Reason**: 
- **Repo commit**: 701b5ddf (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T10-46-10Z-before-build-220-turn-off-4-robots-whole.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_10-46-06_before-build-220-turn-off-4-robots-whole"`


## 2026-11-11 11:12:49 — Before: Build #222 daily robots.txt check for feeds

- **ID**: 2026-11-11_11-08-52_before-build-222-daily-robots-txt-check
- **Reason**: 
- **Repo commit**: 4913e834 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T11-08-58Z-before-build-222-daily-robots-txt-check.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_11-08-52_before-build-222-daily-robots-txt-check"`


## 2026-11-11 11:44:14 — Before: Build #223 creators without declared country by language and region

- **ID**: 2026-11-11_11-38-50_before-build-223-creators-without-declar
- **Reason**: 
- **Repo commit**: 388eb2af (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T11-39-00Z-before-build-223-creators-without-declar.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_11-38-50_before-build-223-creators-without-declar"`


## 2026-11-11 13:37:30 — Before Build #224: queued YouTube discovery jobs to search v3

- **ID**: 2026-11-11_13-33-37_before-build-224-queued-youtube-discover
- **Reason**: 
- **Repo commit**: fa8083d6 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T13-33-40Z-before-build-224-queued-youtube-discover.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_13-33-37_before-build-224-queued-youtube-discover"`


## 2026-11-11 14:03:57 — Before Build #225: Aftonbladet feed URL to rss.aftonbladet.se

- **ID**: 2026-11-11_14-00-15_before-build-225-aftonbladet-feed-url-to
- **Reason**: 
- **Repo commit**: e1cf59d4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T14-00-18Z-before-build-225-aftonbladet-feed-url-to.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_14-00-15_before-build-225-aftonbladet-feed-url-to"`


## 2026-11-11 14:19:18 — Before Build #226: YouTube search terms for 30 African countries

- **ID**: 2026-11-11_14-15-27_before-build-226-youtube-search-terms-fo
- **Reason**: 
- **Repo commit**: 087d1ec4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T14-15-31Z-before-build-226-youtube-search-terms-fo.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_14-15-27_before-build-226-youtube-search-terms-fo"`


## 2026-11-11 14:49:39 — Before Build #227: suggested-reject notes on creator candidates

- **ID**: 2026-11-11_14-45-56_before-build-227-suggested-reject-notes
- **Reason**: 
- **Repo commit**: bb3cd049 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T14-45-59Z-before-build-227-suggested-reject-notes.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_14-45-56_before-build-227-suggested-reject-notes"`


## 2026-11-11 21:50:07 — Before: Build #228 creator YouTube metrics job

- **ID**: 2026-11-11_21-46-26_before-build-228-creator-youtube-metrics
- **Reason**: 
- **Repo commit**: 7e656ff7 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T21-46-32Z-before-build-228-creator-youtube-metrics.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_21-46-26_before-build-228-creator-youtube-metrics"`


## 2026-11-11 21:59:09 — Before: Build #228 owner bulk reject of 18 creator candidates

- **ID**: 2026-11-11_21-55-20_before-build-228-owner-bulk-reject-of-18
- **Reason**: 
- **Repo commit**: 7e656ff7 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T21-55-23Z-before-build-228-owner-bulk-reject-of-18.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_21-55-20_before-build-228-owner-bulk-reject-of-18"`


## 2026-11-11 22:28:53 — Before: Build #229 media-brand type on 18 creator candidates

- **ID**: 2026-11-11_22-25-10_before-build-229-media-brand-type-on-18
- **Reason**: 
- **Repo commit**: d512a78e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T22-25-13Z-before-build-229-media-brand-type-on-18.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_22-25-10_before-build-229-media-brand-type-on-18"`


## 2026-11-11 22:54:30 — Before: Build #230 Dakar Matin official_website evidence

- **ID**: 2026-11-11_22-50-56_before-build-230-dakar-matin-official-we
- **Reason**: 
- **Repo commit**: 0fd14b8e (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T22-50-59Z-before-build-230-dakar-matin-official-we.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_22-50-56_before-build-230-dakar-matin-official-we"`


## 2026-11-11 23:45:10 — Before: Build #231 public creator directory

- **ID**: 2026-11-11_23-41-40_before-build-231-public-creator-director
- **Reason**: 
- **Repo commit**: 7c9372b6 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-11T23-41-43Z-before-build-231-public-creator-director.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-11_23-41-40_before-build-231-public-creator-director"`


## 2026-11-12 00:28:48 — Before: Build #232 remove URL-less cross_link evidence

- **ID**: 2026-11-12_00-24-48_before-build-232-remove-url-less-cross-l
- **Reason**: 
- **Repo commit**: 5fa6d46d (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T00-24-53Z-before-build-232-remove-url-less-cross-l.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_00-24-48_before-build-232-remove-url-less-cross-l"`


## 2026-11-12 00:44:51 — Before: Build #233 evidence URL validation

- **ID**: 2026-11-12_00-39-28_before-build-233-evidence-url-validation
- **Reason**: 
- **Repo commit**: 0eaf4ab4 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T00-39-31Z-before-build-233-evidence-url-validation.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_00-39-28_before-build-233-evidence-url-validation"`


## 2026-11-12 00:59:23 — Before: Build #234 admin evidence form default

- **ID**: 2026-11-12_00-54-15_before-build-234-admin-evidence-form-def
- **Reason**: 
- **Repo commit**: 7c1cf755 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T00-54-19Z-before-build-234-admin-evidence-form-def.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_00-54-15_before-build-234-admin-evidence-form-def"`


## 2026-11-12 01:28:00 — Before: Build #235 creator ranking engine

- **ID**: 2026-11-12_01-24-13_before-build-235-creator-ranking-engine
- **Reason**: 
- **Repo commit**: 77ac4112 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T01-24-17Z-before-build-235-creator-ranking-engine.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_01-24-13_before-build-235-creator-ranking-engine"`


## 2026-11-12 09:22:43 — Before: Build 236 YouTube full error reason in creator-agents

- **ID**: 2026-11-12_09-18-33_before-build-236-youtube-full-error-reas
- **Reason**: 
- **Repo commit**: 92900471 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T09-18-39Z-before-build-236-youtube-full-error-reas.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_09-18-33_before-build-236-youtube-full-error-reas"`


## 2026-11-12 09:44:55 — Before: Build 237 reject 14 creator candidates

- **ID**: 2026-11-12_09-41-26_before-build-237-reject-14-creator-candi
- **Reason**: 
- **Repo commit**: 97182990 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T09-41-29Z-before-build-237-reject-14-creator-candi.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_09-41-26_before-build-237-reject-14-creator-candi"`


## 2026-11-12 09:56:27 — Before: Build 238 two media brands and one reject

- **ID**: 2026-11-12_09-52-48_before-build-238-two-media-brands-and-on
- **Reason**: 
- **Repo commit**: 78d603f0 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T09-52-51Z-before-build-238-two-media-brands-and-on.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_09-52-48_before-build-238-two-media-brands-and-on"`


## 2026-11-12 10:06:08 — Before: Build 239 discovery quality Topic skip and suggestion lists

- **ID**: 2026-11-12_10-01-47_before-build-239-discovery-quality-topic
- **Reason**: 
- **Repo commit**: 31f3880b (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T10-01-51Z-before-build-239-discovery-quality-topic.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_10-01-47_before-build-239-discovery-quality-topic"`


## 2026-11-12 10:53:57 — Before: Build 240 retry timing and bank names

- **ID**: 2026-11-12_10-49-22_before-build-240-retry-timing-and-bank-n
- **Reason**: 
- **Repo commit**: 8c3f0274 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T10-49-25Z-before-build-240-retry-timing-and-bank-n.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_10-49-22_before-build-240-retry-timing-and-bank-n"`


## 2026-11-12 14:06:35 — Before: Build #241 batch channel lookups, Somalia search, requeue jobs 40 41 43

- **ID**: 2026-11-12_14-02-34_before-build-241-batch-channel-lookups-s
- **Reason**: 
- **Repo commit**: 87c17dd3 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T14-02-44Z-before-build-241-batch-channel-lookups-s.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_14-02-34_before-build-241-batch-channel-lookups-s"`


## 2026-11-12 15:16:03 — Before: jobs 40 41 43 to front of queue + Build #242 quota budget message

- **ID**: 2026-11-12_15-12-22_before-jobs-40-41-43-to-front-of-queue-b
- **Reason**: 
- **Repo commit**: 75ba9853 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T15-12-26Z-before-jobs-40-41-43-to-front-of-queue-b.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_15-12-22_before-jobs-40-41-43-to-front-of-queue-b"`


## 2026-11-12 21:02:51 — Before: Build #243 nightly DB backup, copy to Windows, retention

- **ID**: 2026-11-12_20-58-40_before-build-243-nightly-db-backup-copy
- **Reason**: 
- **Repo commit**: 349c6de3 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T20-58-46Z-before-build-243-nightly-db-backup-copy.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_20-58-40_before-build-243-nightly-db-backup-copy"`


## 2026-11-12 23:58:23 — Before: Build #244 YouTube creator ranking on /youtube

- **ID**: 2026-11-12_23-54-23_before-build-244-youtube-creator-ranking
- **Reason**: 
- **Repo commit**: 1e5091a3 (main)
- **Target**: OnPrem
- **K8s state captured**: True
- **DB backup**: dr-rke2:~/ndp-backups/onprem-2026-11-12T23-54-30Z-before-build-244-youtube-creator-ranking.dump
- **Impact**: Low
- **Files affected**: 
- **Rollback**: `.\Invoke-Rollback.ps1 -PointId "2026-11-12_23-54-23_before-build-244-youtube-creator-ranking"`

