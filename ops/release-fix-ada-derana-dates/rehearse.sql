-- Build #166 part 1 (MEDIUM): Ada Derana (LK, publisher 1012) -- its feed (adaderana.lk/rss.php) has no item dates, so all
-- 2,045 stored articles have published_at NULL (333 in the last 7 days) and drop out of date-ordered views.
-- 1) feed 1012 gets parser_config undated = 'fetch_time' (existing worker option, as The Baltic Times): new items take
--    their fetch time, stepped back a minute per position in the feed.
-- 2) existing undated rows get published_at = fetched_at (approximate: items of the very first fetch keep that time).
-- The ids changed are printed first (restore record). Owner, 2026-11-05: "fix Ada Derana". rehearse.sql = ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM articles WHERE publisher_id = 1012 AND published_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 1012 AND slug = 'ada-derana') OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 1012 AND publisher_id = 1012 AND NOT parser_config ? 'undated')
     OR n NOT BETWEEN 2000 AND 2300 THEN
    RAISE EXCEPTION 'Ada Derana not in the expected state (% undated rows) - nothing changed', n;
  END IF;
END $do$;
\echo ===IDS-BEGIN===
SELECT string_agg(id::text, ',' ORDER BY id) FROM articles WHERE publisher_id = 1012 AND published_at IS NULL;
\echo ===IDS-END===
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"undated": "fetch_time"}'::jsonb WHERE id = 1012;
UPDATE articles SET published_at = fetched_at WHERE publisher_id = 1012 AND published_at IS NULL;
SELECT 'after', count(*) FILTER (WHERE published_at IS NULL) undated, min(published_at), max(published_at) FROM articles WHERE publisher_id = 1012;
SELECT 'feed', id, parser_config FROM feeds WHERE id = 1012;
ROLLBACK;
