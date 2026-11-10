-- Build #207: suspend Notre Voie (publisher 8894, CI) and disable its feed 8892. notrevoie.com is a parked domain
-- (/lander, 114-byte page) and the paper's older notrevoienews.com now redirects to a slot-gambling site; no new site
-- found (11-10). 0 articles ever stored; the publisher was already 'unavailable' (not polled), but /source/notre-voie
-- still linked readers to the parked domain. Suspended publishers are hidden from public pages (Build #49 rule).
-- Owner: "yes, approve Build #207". Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql undoes.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT p.id, p.slug, p.feed_status, f.id, f.feed_url, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8894;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers p JOIN feeds f ON f.publisher_id = p.id
                 WHERE p.id = 8894 AND p.slug = 'notre-voie' AND p.feed_status = 'unavailable'
                   AND f.id = 8892 AND f.feed_url = 'https://www.notrevoie.com/sitemap.xml' AND f.enabled)
     OR (SELECT count(*) FROM feeds WHERE publisher_id = 8894) <> 1
     OR EXISTS (SELECT 1 FROM articles WHERE publisher_id = 8894) THEN
    RAISE EXCEPTION 'Publisher 8894 is not the unavailable, article-less Notre Voie with its one notrevoie.com feed - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 8894;
UPDATE feeds SET enabled = false WHERE id = 8892;
\echo ===AFTER===
SELECT p.id, p.slug, p.feed_status, f.id, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8894;
COMMIT;
