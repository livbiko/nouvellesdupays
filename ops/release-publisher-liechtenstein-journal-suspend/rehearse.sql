-- Build #219: suspend Liechtenstein-Journal (publisher 525, LI) and disable its feed 525. 0 articles ever stored; its
-- feed's newest item and its own sitemap both stop at 2026-06-26 (checked 11-11 with the worker UA). Suspension hides
-- /source/liechtenstein-journal and the publisher lists (routes.js feed_status filters); no articles to hide.
-- Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql undoes.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT p.id, p.slug, p.feed_status, f.id, f.feed_url, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 525;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers p JOIN feeds f ON f.publisher_id = p.id
                 WHERE p.id = 525 AND p.slug = 'liechtenstein-journal' AND p.feed_status = 'active'
                   AND f.id = 525 AND f.feed_url = 'https://www.liechtenstein-journal.li/feed' AND f.enabled)
     OR (SELECT count(*) FROM feeds WHERE publisher_id = 525) <> 1
     OR EXISTS (SELECT 1 FROM articles WHERE publisher_id = 525) THEN
    RAISE EXCEPTION 'Publisher 525 is not the active, article-less Liechtenstein-Journal with its one feed - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 525;
UPDATE feeds SET enabled = false WHERE id = 525;
\echo ===AFTER===
SELECT p.id, p.slug, p.feed_status, f.id, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 525;
ROLLBACK;
