-- REHEARSAL (ROLLBACK). -- Dagbladet (NO, publisher 10105, feed 10124, added in Build #169): its live-blog ("studio") items carry no pubDate, so
-- they are stored with published_at NULL (3 rows after the first poll) and drop out of date-ordered views.
-- 1) feed 10124 gets parser_config undated = 'fetch_time' (existing worker option, as Ada Derana): new undated items take
--    their fetch time, stepped back a minute per position in the feed. Dated items are unaffected.
-- 2) existing undated rows get published_at = fetched_at.
-- The ids changed are printed first (restore record). Owner, 2026-11-05: "fix Dagbladet". rehearse.sql = ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM articles WHERE publisher_id = 10105 AND published_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 10105 AND slug = 'dagbladet') OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 10124 AND publisher_id = 10105 AND NOT coalesce(parser_config, '{}'::jsonb) ? 'undated')
     OR n NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Dagbladet not in the expected state (% undated rows) - nothing changed', n;
  END IF;
END $do$;
\echo ===IDS-BEGIN===
SELECT string_agg(id::text, ',' ORDER BY id) FROM articles WHERE publisher_id = 10105 AND published_at IS NULL;
\echo ===IDS-END===
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"undated": "fetch_time"}'::jsonb WHERE id = 10124;
UPDATE articles SET published_at = fetched_at WHERE publisher_id = 10105 AND published_at IS NULL;
SELECT 'after', count(*) FILTER (WHERE published_at IS NULL) undated, min(published_at), max(published_at) FROM articles WHERE publisher_id = 10105;
SELECT 'feed', id, parser_config FROM feeds WHERE id = 10124;
ROLLBACK;
