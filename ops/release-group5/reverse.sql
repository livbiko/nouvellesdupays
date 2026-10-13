-- Reverse of apply.sql: old feeds re-enabled, the new sources and the articles they stored deleted.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 6762 AND feed_url = 'https://www.aib.media/?feed=rss2') THEN
    RAISE EXCEPTION 'nothing to reverse for 6762: the new source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 6762) <> 2 THEN
    RAISE EXCEPTION 'publisher 6762 has sources other than the two expected'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 1037 AND feed_url = 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml') THEN
    RAISE EXCEPTION 'nothing to reverse for 1037: the new source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 1037) <> 2 THEN
    RAISE EXCEPTION 'publisher 1037 has sources other than the two expected'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 209 AND feed_url = 'https://standard.gm/news-sitemap.xml') THEN
    RAISE EXCEPTION 'nothing to reverse for 209: the new source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 209) <> 2 THEN
    RAISE EXCEPTION 'publisher 209 has sources other than the two expected'; END IF;
END $$;
DELETE FROM articles WHERE feed_id IN (SELECT id FROM feeds WHERE feed_url IN ('https://www.aib.media/?feed=rss2', 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml', 'https://standard.gm/news-sitemap.xml'));
DELETE FROM feeds WHERE feed_url IN ('https://www.aib.media/?feed=rss2', 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml', 'https://standard.gm/news-sitemap.xml');
UPDATE feeds SET enabled = true WHERE id IN (6762,1037,209);
COMMIT;
