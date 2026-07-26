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

