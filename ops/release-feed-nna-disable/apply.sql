-- Build #209: disable NNA's frozen English RSS (feed 9050, publisher 9028 National News Agency, Lebanon). The feed's
-- newest item is still 2026-09-21, so every run reports ok and stores nothing (0 articles ever). The site's article
-- lists are client-rendered (no links in static HTML) and its sitemaps nest three levels (news.xml -> 19 category
-- indexes of ~245 KB -> per-day sitemaps), which the crawler cannot follow without code. Lebanon is covered by
-- Annahar, LBCI and Naharnet. Owner chose C (leave NNA parked, switch the dead feed off). The publisher stays active.
-- Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql re-enables the feed.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, f.feed_url, f.feed_type, f.enabled, p.id, p.feed_status FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 9050;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 9050 AND publisher_id = 9028 AND feed_url = 'https://www.nna-leb.gov.lb/en/rss'
                   AND feed_type = 'rss' AND enabled)
     OR EXISTS (SELECT 1 FROM articles WHERE feed_id = 9050) THEN
    RAISE EXCEPTION 'Feed 9050 is not the enabled, article-less NNA English RSS - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET enabled = false WHERE id = 9050;
\echo ===AFTER===
SELECT f.id, f.enabled, p.feed_status FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 9050;
COMMIT;
