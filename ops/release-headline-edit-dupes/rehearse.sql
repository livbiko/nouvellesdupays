-- Build #187 rehearsal: targets, guard, a sample of kept vs deleted rows, one 500-row batch deleted and rolled back.
\set ON_ERROR_STOP on
SET statement_timeout = '600s';
\i /sql/targets.inc.sql
\echo ===SAMPLE (kept row first, then 3 of its deleted copies)===
SELECT k.id kept, left(k.headline, 60) kept_headline, d.id deleted, left(d.headline, 60) deleted_headline
  FROM (SELECT keep_id FROM t GROUP BY 1 ORDER BY count(*) DESC LIMIT 3) g
  JOIN articles k ON k.id = g.keep_id
  JOIN LATERAL (SELECT a.id, a.headline FROM t JOIN articles a ON a.id = t.id WHERE t.keep_id = g.keep_id ORDER BY a.id DESC LIMIT 3) d ON true;
\echo ===ONE BATCH, ROLLED BACK===
BEGIN;
SET LOCAL lock_timeout = '5s';
\timing on
WITH b AS (SELECT id FROM t ORDER BY id LIMIT 500) DELETE FROM articles WHERE id IN (SELECT id FROM b);
\timing off
ROLLBACK;
SELECT 'still there after rollback', count(*) FROM articles WHERE id IN (SELECT id FROM t ORDER BY id LIMIT 500);
