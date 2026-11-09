-- Build #203: RTB (Radiodiffusion Television du Burkina, BF, feed 8921) has never stored an article: the feed crawls the
-- homepage (http://www.rtb.bf/) with no article_url_patterns. Found by the 11-09 survey of crawl feeds that report ok
-- but stored nothing in 7 days. The site has a WordPress RSS feed, https://www.rtb.bf/feed/ (10 items, newest
-- 11-08 22:38 UTC, /YYYY/MM/DD/slug/ links, with description, no images); some items are TV programmes (JT de 20h).
-- Owner: "yes, prepare Build #203". Get-ChangeRisk MEDIUM.
-- rehearse.sql is this file with ROLLBACK; reverse.sql switches back.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.article_url_patterns, f.allowed_domains, f.parser_config, f.etag, f.last_modified
  FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 8921;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 8921 AND p.slug = 'radiodiffusion-television-du-burkina' AND f.feed_type = 'html'
                   AND f.feed_url = 'http://www.rtb.bf/') THEN
    RAISE EXCEPTION 'Feed 8921 is not the RTB homepage crawl - nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.rtb.bf/feed/') THEN
    RAISE EXCEPTION 'A feed for the RTB RSS already exists - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://www.rtb.bf/feed/', feed_type = 'rss', etag = NULL, last_modified = NULL
  WHERE id = 8921;
\echo ===AFTER===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.article_url_patterns, f.allowed_domains, f.parser_config, f.etag, f.last_modified
  FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 8921;
COMMIT;
