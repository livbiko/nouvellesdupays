-- Build #199: Global Times (CN, feed 963) has stored nothing since 2026-10-09 while reporting ok: its feed
-- (rss/outbrain.xml) stopped updating -- newest item 2026-01-28. The site's /sitemap.xml (listed in robots.txt) is a
-- Google News sitemap: 61 English items on 11-08, same /page/YYYYMM/ID.shtml URLs as the stored rows. Same setup as
-- Bernama and Prensa Libre (Build #198); the sitemap has no summary. Get-ChangeRisk MEDIUM; owner: "go for 1".
-- rehearse.sql is this file with ROLLBACK; reverse.sql switches back.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.etag, f.last_modified, f.consecutive_failures FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 963;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 963 AND p.slug = 'global-times' AND f.feed_type = 'rss'
                   AND f.feed_url = 'https://www.globaltimes.cn/rss/outbrain.xml') THEN
    RAISE EXCEPTION 'Feed 963 is not the Global Times outbrain feed - nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.globaltimes.cn/sitemap.xml') THEN
    RAISE EXCEPTION 'A feed for the news sitemap already exists - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://www.globaltimes.cn/sitemap.xml', feed_type = 'sitemap-news',
                 etag = NULL, last_modified = NULL
  WHERE id = 963;
\echo ===AFTER===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.etag, f.last_modified, f.consecutive_failures FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 963;
COMMIT;
