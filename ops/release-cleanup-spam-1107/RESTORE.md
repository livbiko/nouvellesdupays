# Build #190 — restoring what the cleanup changed

Applied 2026-11-07 ~17:55 UTC on on-prem production. `apply.sql` printed the 2 deleted rows as CSV (column 1 = action,
then all `articles` columns) before deleting them. Full psql output, outside git:
`ops/recovery-points/2026-11-07_17-49-47_before-build-190-delete-2-bhutan-spam-ar/build190-apply-output.txt`
(CSV between `===CSV-BEGIN===` and `===CSV-END===`; state before under `===STATE-BEFORE===`).

## Filter only (the usual rollback)

```sql
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(parser_config ->> 'exclude_title_pattern', '\b(?:\w*casino\w*|jeu responsable|uitbetaling\w*|', '\b(?:casino\w*|'))
  WHERE id = 1020;  -- Business Bhutan, back to the Build #185 pattern
```

## The 2 rows

Both spam on businessbhutan.bt (a Dutch CookieCasino payout post and a French Majestic Slots "jeu responsable" post).
To bring them back anyway: load the CSV as in `../release-cleanup-spam-1106/RESTORE.md`. Row ids are kept.

## Full restore (last resort, HIGH, needs a window)

`pg_restore --clean --if-exists` of
`/home/ubuntu/ndp-backups/onprem-2026-11-07T17-49-53Z-before-build-190-delete-2-bhutan-spam-ar.dump` on dr-rke2 —
this also rolls back everything ingested since 17:49 UTC.
