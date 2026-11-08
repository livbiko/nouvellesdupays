-- Build #198: Prensa Libre (GT, feed 1515) has timed out on every worker run since 2026-11-08 12:40 UTC. Its RSS
-- (/feed) is 4.2 MB -- 99 items with full article text -- and fetches in ~4.7 s alone but runs past the 15 s limit
-- among a run's 20 parallel fetches. Its Google News sitemap (listed in robots.txt) is 85 KB, 145 items over 2 days,
-- same URLs and headlines, so stored rows dedup as before. Trade-off: the sitemap has no summary, so new rows have
-- none. Same setup as Bernama (feed 10244). Get-ChangeRisk MEDIUM; owner: "go ahead with A".
-- rehearse.sql is this file with ROLLBACK; reverse.sql switches back.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.etag, f.last_modified, f.consecutive_failures FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 1515;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 1515 AND p.slug = 'prensa-libre' AND f.feed_type = 'rss'
                   AND f.feed_url = 'https://www.prensalibre.com/feed') THEN
    RAISE EXCEPTION 'Feed 1515 is not the Prensa Libre RSS feed - nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.prensalibre.com/news-sitemap.xml') THEN
    RAISE EXCEPTION 'A feed for the news sitemap already exists - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://www.prensalibre.com/news-sitemap.xml', feed_type = 'sitemap-news',
                 etag = NULL, last_modified = NULL
  WHERE id = 1515;
\echo ===AFTER===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.etag, f.last_modified, f.consecutive_failures FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 1515;
COMMIT;
