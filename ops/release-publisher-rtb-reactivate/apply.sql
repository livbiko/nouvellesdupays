-- Build #204: reactivate RTB (Radiodiffusion Television du Burkina, publisher 8923, BF). Suspended in Build #49 (10-10)
-- as uncrawlable -- its homepage crawl stored nothing. Build #203 moved its only feed (8921) to the working RSS
-- https://www.rtb.bf/feed/, so the reason no longer holds. Only active publishers are polled and listed publicly.
-- Owner: "yes, reactivate RTB". Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql re-suspends.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT p.id, p.slug, p.feed_status, f.id, f.feed_url, f.feed_type, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8923;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers p JOIN feeds f ON f.publisher_id = p.id
                 WHERE p.id = 8923 AND p.slug = 'radiodiffusion-television-du-burkina' AND p.feed_status = 'suspended'
                   AND f.id = 8921 AND f.feed_url = 'https://www.rtb.bf/feed/' AND f.feed_type = 'rss' AND f.enabled) THEN
    RAISE EXCEPTION 'Publisher 8923 is not the suspended RTB with its RSS feed - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET feed_status = 'active' WHERE id = 8923;
\echo ===AFTER===
SELECT p.id, p.slug, p.feed_status FROM publishers p WHERE p.id = 8923;
COMMIT;
