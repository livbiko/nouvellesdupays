# Build #193 — restoring what the cleanup changed

`apply.sql` prints the deleted rows as CSV (column 1 = action, then all `articles` columns) before deleting them. Save the
psql output in the recovery point folder (`build193-apply-output.txt`, outside git); the CSV sits between
`===CSV-BEGIN===` and `===CSV-END===`, the feed's state before under `===STATE-BEFORE===`.

## Filter only (the usual rollback)

```sql
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(parser_config ->> 'exclude_title_pattern', '|bet|slots?|', '|slots?|'))
  WHERE id = 1020;  -- Business Bhutan, back to the Build #190 pattern
```

## The rows

All posted on businessbhutan.bt by the spam accounts wps_ebe76b6454 / kaia54591. To bring them back anyway: load the CSV
as in `../release-cleanup-spam-1106/RESTORE.md`. Row ids are kept.

## Full restore (last resort, HIGH, needs a window)

`pg_restore --clean --if-exists` of the recovery point's dump on dr-rke2 — this also rolls back everything ingested since.
