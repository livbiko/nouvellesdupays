# Build #160 — restoring what the cleanup changed

Applied 2026-11-05 04:32 UTC on on-prem production. `apply.sql` printed every affected row, before changing it,
as CSV (column 1 = action, then all `articles` columns). Saved, outside git, in
`ops/recovery-points/2026-11-05_04-25-58_before-build-160-cleanup-misfiled-and-sp/`:

- `build160-affected-rows.csv` — 2,052 rows: delete-misfiled 1,835, reassign-misfiled 34, delete-islaminfo 105,
  delete-bt-spam 75, delete-leadership-spam 3
- `apply-output.txt` — full psql output, including the state before (islaminfo `active`; Business Bhutan feed 1020
  `parser_config = {}`)

## Partial restore (preferred)

The CSV is ~1.4 MB, too large for `Sql-OnPrem.ps1` (it passes SQL in a pod env var). Copy it next to the dumps and
load it with a pod that mounts that folder, as `onprem-dump.sh` does:

1. `scp build160-affected-rows.csv ubuntu@192.168.1.51:/home/ubuntu/ndp-backups/`
2. In a postgres:16-alpine pod with `DATABASE_URL` from `nouvellesdupays-secrets` and hostPath
   `/home/ubuntu/ndp-backups` mounted at `/backups`, run in one transaction:
   - `CREATE TEMP TABLE r (action text, LIKE articles);`
   - `\copy r FROM '/backups/build160-affected-rows.csv' WITH CSV HEADER`
   - `DELETE FROM articles WHERE id IN (SELECT id FROM r WHERE action = 'reassign-misfiled');`
   - `INSERT INTO articles SELECT (r).* minus action ...` — i.e. `INSERT INTO articles (<all columns>) SELECT <all columns> FROM r;`
   - `UPDATE publishers SET feed_status = 'active' WHERE slug = 'islaminfo';`
   - `UPDATE feeds SET parser_config = parser_config - 'exclude_title_pattern' WHERE id = 1020;`

Row ids are kept, so the restore is exact. Nothing references `articles` by foreign key.

## Full restore (last resort, HIGH, needs a window)

`pg_restore --clean --if-exists` of
`/home/ubuntu/ndp-backups/onprem-2026-11-05T04-26-21Z-before-build-160-cleanup-misfiled-and-sp.dump` — this also
rolls back every article ingested since 04:26.
