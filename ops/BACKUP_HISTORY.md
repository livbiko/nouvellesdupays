# NouvellesDuPays Backup History

Recovery points are created by `.\ops\scripts\New-RecoveryPoint.ps1` and logged
here automatically. See `CHANGE_MGMT.md` for when a recovery point is required.

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

