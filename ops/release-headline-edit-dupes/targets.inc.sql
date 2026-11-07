-- Shared by rehearse.sql and apply.sql: one row per article to delete, with the row kept for its URL.
-- Scope (owner 2026-11-06: "latest headline, last 30 days"): copies fetched since 2026-10-08 of a URL the same publisher
-- holds more than once; the newest row (highest id = latest headline) is kept, the older copies go.
CREATE TEMP TABLE t AS
  SELECT id, keep_id FROM (
    SELECT id, max(id) OVER (PARTITION BY publisher_id, original_url) keep_id
      FROM articles WHERE fetched_at > '2026-10-08 00:00+00') s
  WHERE id <> keep_id;
CREATE UNIQUE INDEX ON t (id);
ANALYZE t;
\echo ===TARGETS===
SELECT 'rows to delete', count(*), 'urls', count(DISTINCT keep_id) FROM t;
SELECT p.slug, count(*) FROM t JOIN articles a ON a.id = t.id JOIN publishers p ON p.id = a.publisher_id GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM t;
  IF n NOT BETWEEN 90000 AND 140000 THEN RAISE EXCEPTION 'target count % outside 90k-140k - nothing changed', n; END IF;
END $do$;
