-- Group 5 of the erroring-sources review (2026-10-13): three publishers whose feeds are gone, moved to working sources.
--   6762 AIB (BF):           https://www.aib.media/feed (404)        -> RSS https://www.aib.media/?feed=rss2 (20/20 dated)
--   1037 Saudi Gazette (SA): https://saudigazette.com.sa/rss (bad XML) -> sitemap-news .../sitemaps/news_sitemap.xml (68/68 dated)
--   209  The Standard (GM):  https://www.standard.gm/feed (404)       -> sitemap-news https://standard.gm/news-sitemap.xml (31/31 dated)
-- MEDIUM per Get-ChangeRisk. Mirrors, per publisher, in one guarded transaction:
--   POST /api/admin/publishers/:id/sources {feed_type, feed_url}   PATCH /api/admin/sources/:id {enabled: false} (old feed kept)
-- Reverse: reverse.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 6762 AND name = 'AIB (Agence d''Information du Burkina)' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 6762 is not the active AIB (Agence dInformation du Burkina)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 6762 AND publisher_id = 6762 AND feed_url = 'https://www.aib.media/feed' AND enabled) THEN
    RAISE EXCEPTION 'feed 6762 is not the enabled old feed https://www.aib.media/feed'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 6762) <> 1 THEN
    RAISE EXCEPTION 'publisher 6762 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.aib.media/?feed=rss2') THEN
    RAISE EXCEPTION 'a source with https://www.aib.media/?feed=rss2 already exists'; END IF;
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 1037 AND name = 'Saudi Gazette' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 1037 is not the active Saudi Gazette'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 1037 AND publisher_id = 1037 AND feed_url = 'https://saudigazette.com.sa/rss' AND enabled) THEN
    RAISE EXCEPTION 'feed 1037 is not the enabled old feed https://saudigazette.com.sa/rss'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 1037) <> 1 THEN
    RAISE EXCEPTION 'publisher 1037 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml') THEN
    RAISE EXCEPTION 'a source with https://saudigazette.com.sa/sitemaps/news_sitemap.xml already exists'; END IF;
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 209 AND name = 'The Standard' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 209 is not the active The Standard'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 209 AND publisher_id = 209 AND feed_url = 'https://www.standard.gm/feed' AND enabled) THEN
    RAISE EXCEPTION 'feed 209 is not the enabled old feed https://www.standard.gm/feed'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 209) <> 1 THEN
    RAISE EXCEPTION 'publisher 209 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://standard.gm/news-sitemap.xml') THEN
    RAISE EXCEPTION 'a source with https://standard.gm/news-sitemap.xml already exists'; END IF;
END $$;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (6762, 'https://www.aib.media/?feed=rss2', 'rss', NULL, true, true, '{}', '{}', '{}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 6762;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (1037, 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml', 'sitemap-news', NULL, true, true, '{}', '{}', '{}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 1037;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (209, 'https://standard.gm/news-sitemap.xml', 'sitemap-news', NULL, true, true, '{}', '{}', '{}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 209;
COMMIT;
