-- Build #212: disable feed 9263, an unused duplicate of Le Mauricien's primary feed. 9263
-- (https://www.lemauricien.com/feed) is the same WordPress feed as 301 (https://www.lemauricien.com/feed/?src=ndp);
-- both report not_modified/ok every run, but all 567 Le Mauricien articles of the last 30 days were stored by 301 and
-- 9263 stored none. Found by the 11-11 per-publisher check. Get-ChangeRisk MEDIUM. rehearse.sql = this file with
-- ROLLBACK; reverse.sql re-enables.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, f.publisher_id, f.enabled, f.feed_url, f.last_status,
       (SELECT count(*) FROM articles a WHERE a.publisher_id = 301 AND a.feed_id = f.id AND a.published_at > now() - interval '30 days') AS n30
FROM feeds f WHERE f.id IN (301, 9263) ORDER BY f.id;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 9263 AND publisher_id = 301 AND enabled AND feed_url = 'https://www.lemauricien.com/feed')
  OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 301 AND publisher_id = 301 AND enabled)
  OR NOT EXISTS (SELECT 1 FROM articles WHERE publisher_id = 301 AND feed_id = 301 AND published_at > now() - interval '7 days')
  OR EXISTS (SELECT 1 FROM articles WHERE publisher_id = 301 AND feed_id = 9263 AND published_at > now() - interval '30 days') THEN
    RAISE EXCEPTION 'guard failed (9263 moved/disabled/storing, or primary 301 not working) - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET enabled = false WHERE id = 9263;
\echo ===AFTER===
SELECT id, enabled FROM feeds WHERE id IN (301, 9263) ORDER BY id;
COMMIT;
