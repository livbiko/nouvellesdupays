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

