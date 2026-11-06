# Build #185 — restoring what the cleanup changed

Applied 2026-11-06 ~23:40 UTC on on-prem production. `apply.sql` printed the 6 deleted rows as CSV (column 1 = action,
then all `articles` columns) before deleting them. Full psql output, outside git:
`ops/recovery-points/2026-11-06_16-00-12_before-build-185-delete-6-spam-articles/build185-apply-output.txt`
(CSV between `===CSV-BEGIN===` and `===CSV-END===`; state before under `===STATE-BEFORE===`).

## Filters only (the usual rollback)

```sql
UPDATE feeds SET parser_config = parser_config - 'exclude_title_pattern' WHERE id = 8;  -- Leadership, was {}
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(replace(parser_config ->> 'exclude_title_pattern', 'casino\w*|', 'casinos?|'), '|onlyfans|havadurumu\w*)', '|onlyfans)'))
  WHERE id = 1020;  -- Business Bhutan, back to the Build #160 pattern
```

## The 6 rows

All spam (4 Thai gambling posts on leadership.ng, a Casinova post and a Turkish weather SEO post on businessbhutan.bt).
To bring them back anyway: cut the CSV out of the output file, drop column 1, and load it as in
`../release-cleanup-misfiled-spam/RESTORE.md` (`\copy` into a temp table, then `INSERT INTO articles`). Row ids are kept.

## Full restore (last resort, HIGH, needs a window)

`pg_restore --clean --if-exists` of
`/home/ubuntu/ndp-backups/onprem-2026-11-06T16-00-16Z-before-build-185-delete-6-spam-articles.dump` on dr-rke2 —
this also rolls back everything ingested since 16:00 UTC.
