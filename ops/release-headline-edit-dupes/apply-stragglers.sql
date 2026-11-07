-- Same as apply.sql with a 1-2000 guard, for the copies left after the #187 run (26 at 00:29).
-- Build #187 (MEDIUM, owner approved 2026-11-06: "latest headline, last 30 days"): delete older copies of URLs stored
-- more than once because of headline edits. Every deleted row is first saved, in full, to a CSV next to the dumps on
-- dr-rke2 (column 1 = the id kept for that URL). Then 500 rows per transaction with a 4 s pause, so worker inserts
-- are never held up (2026-10-14 lesson). Interrupted? Re-run: the targets are recomputed from what is left.
\set ON_ERROR_STOP on
SET statement_timeout = '600s';
\i /sql/targets-stragglers.inc.sql
\echo ===CSV===
\copy (SELECT t.keep_id, a.* FROM articles a JOIN t ON t.id = a.id ORDER BY a.id) TO '/backups/build187-deleted-copies-stragglers.csv' WITH CSV HEADER
SELECT 'csv rows expected', count(*) FROM t;
\echo ===DELETE IN BATCHES===
SET statement_timeout = 0;  -- the DO below is one statement that runs ~17 min; lock_timeout still guards each batch
SET lock_timeout = '5s';
DO $do$
DECLARE n int; total int := 0; batches int := 0;
BEGIN
  LOOP
    WITH b AS (DELETE FROM t WHERE id IN (SELECT id FROM t ORDER BY id LIMIT 500) RETURNING id)
      DELETE FROM articles WHERE id IN (SELECT id FROM b);
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM t) AND n = 0;
    total := total + n; batches := batches + 1;
    COMMIT;
    IF batches % 20 = 0 THEN RAISE NOTICE '% batches, % rows deleted, %', batches, total, clock_timestamp(); END IF;
    PERFORM pg_sleep(4);
  END LOOP;
  RAISE NOTICE 'done: % batches, % rows deleted', batches, total;
END $do$;
\echo ===AFTER===
SELECT 'copies left (fetched since 10-08)', coalesce(sum(n - 1), 0) FROM (
  SELECT count(*) n FROM articles WHERE fetched_at > '2026-10-08 00:00+00' GROUP BY publisher_id, original_url HAVING count(*) > 1) d;
