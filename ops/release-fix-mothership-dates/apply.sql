-- Mothership (SG, feed 998): corrects the 14:11 UTC time-zone change. The feed's dates carry no zone and are UTC
-- last-modified times (an item labelled 18:42 was first fetched 18:45 UTC); the future-dated items read as a zone problem
-- were edited articles. label_time_zone Asia/Singapore therefore put every new date 8 h early.
-- 1) feed 998: remove label_time_zone (dates read as UTC; a modified time later than the fetch gets the fetch time).
-- 2) rows of feed 998 first fetched after the 14:11 change: published_at + 8 h, capped at fetched_at.
-- The ids and old values are printed first (restore record). Owner, 2026-11-05: "fix Mothership". rehearse.sql = ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM articles WHERE feed_id = 998 AND fetched_at > '2026-11-05 14:11:00+00';
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 998 AND parser_config->>'label_time_zone' = 'Asia/Singapore') OR n NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Mothership feed 998 not in the expected state (% rows) - nothing changed', n;
  END IF;
END $do$;
\echo ===ROWS-BEGIN===
SELECT id, published_at, fetched_at FROM articles WHERE feed_id = 998 AND fetched_at > '2026-11-05 14:11:00+00' ORDER BY id;
\echo ===ROWS-END===
UPDATE feeds SET parser_config = parser_config - 'label_time_zone' WHERE id = 998;
UPDATE articles SET published_at = LEAST(published_at + interval '8 hours', fetched_at)
 WHERE feed_id = 998 AND fetched_at > '2026-11-05 14:11:00+00';
SELECT 'after', id, published_at, fetched_at FROM articles WHERE feed_id = 998 AND fetched_at > '2026-11-05 14:11:00+00' ORDER BY id;
SELECT 'feed', id, parser_config FROM feeds WHERE id = 998;
COMMIT;
