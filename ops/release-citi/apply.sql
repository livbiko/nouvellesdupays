-- Citi Newsroom (publisher 6764, GH): https://www.citinewsroom.com/feed/ redirects to the homepage (feed switched off by the
-- site; "Invalid character in tag name", 3,096+ failures, never succeeded). No news sitemap. robots.txt: Allow all.
-- Dry run of the worker's crawlSource from the cluster (2026-10-13, ops/release-citi/citi-dryrun.txt): homepage +
-- /category/breaking-news/, pattern /20*/*/* -> 70 candidates, 8/8 fetched with real headline + date (all that day).
-- MEDIUM per Get-ChangeRisk. Mirrors, in one guarded transaction:
--   POST  /api/admin/publishers/6764/sources {feed_type: html, feed_url, category_urls, article_url_patterns, allowed_domains}
--         (crawl_frequency_minutes = app_settings crawler_default_frequency_minutes, else 60 -- as the endpoint does)
--   PATCH /api/admin/sources/6764 {enabled: false} (old feed kept)
-- Reverse: reverse.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 6764 AND name = 'Citi Newsroom' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 6764 is not the active Citi Newsroom'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 6764 AND publisher_id = 6764 AND feed_url = 'https://www.citinewsroom.com/feed/' AND enabled) THEN
    RAISE EXCEPTION 'feed 6764 is not the enabled old Citi feed'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 6764) <> 1 THEN
    RAISE EXCEPTION 'publisher 6764 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.citinewsroom.com/') THEN
    RAISE EXCEPTION 'a source with https://www.citinewsroom.com/ already exists'; END IF;
END $$;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (6764, 'https://www.citinewsroom.com/', 'html',
        COALESCE((SELECT (value #>> '{}')::int FROM app_settings WHERE key = 'crawler_default_frequency_minutes'
                    AND jsonb_typeof(value) = 'number' AND (value #>> '{}') ~ '^\d+$' AND (value #>> '{}')::int BETWEEN 15 AND 10080), 60),
        true, true, '{citinewsroom.com}', '{https://www.citinewsroom.com/category/breaking-news/}', '{/20*/*/*}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 6764;
COMMIT;
