# Builds #186/#187 — undoing the URL index and the duplicate cleanup

## Build #186 — index `idx_articles_publisher_url_md5`

`.\Run-Index.ps1 rollback.sql` drops it with `DROP INDEX CONCURRENTLY` (no write lock). Do this only after the worker
change (applyHeadlineEdits) is rolled back or accepted as slower: without the index its URL lookup falls back to the
(publisher_id, published_at) index.

## Build #187 — deleted copies

Applied 2026-11-07 ~00:08 UTC on on-prem production. Before deleting, `apply.sql` saved every deleted row in full to
`/home/ubuntu/ndp-backups/build187-deleted-copies.csv` on dr-rke2 (column 1 `keep_id` = the row kept for that URL,
then all `articles` columns). Row ids are kept; nothing references `articles` by foreign key.

Partial restore (preferred) — in a pod like `cleanup-run.sh`'s (hostPath `/home/ubuntu/ndp-backups` on `/backups`),
in one transaction:

```sql
CREATE TEMP TABLE r (keep_id bigint, LIKE articles);
\copy r FROM '/backups/build187-deleted-copies.csv' WITH CSV HEADER
-- dedup_hash is unique: a kept row may since have taken an old headline's hash; those copies can't come back as-is.
INSERT INTO articles SELECT (r).* ... -- i.e. INSERT INTO articles (<all columns>) SELECT <all columns> FROM r
  WHERE NOT EXISTS (SELECT 1 FROM articles a WHERE a.dedup_hash = r.dedup_hash);
```

Full restore (last resort, HIGH, needs a window): `pg_restore --clean --if-exists` of
`/home/ubuntu/ndp-backups/onprem-2026-11-07T00-07-25Z-before-build-187-delete-headline-edit-du.dump` — also rolls
back everything ingested since 00:07 UTC.
