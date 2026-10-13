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
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 6764),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id = 6764),
  (select count(*) from feeds where publisher_id = 6764),
  (select count(*) from articles where publisher_id = 6764)));
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
select 'verify|' || string_agg(f.id || ':' || f.enabled || ':' || f.feed_type || ':' || coalesce(f.crawl_frequency_minutes::text, '-') || ':' || f.feed_url || ':' || f.allowed_domains::text || ':' || f.category_urls::text || ':' || f.article_url_patterns::text, ' ' order by f.id) from feeds f where f.publisher_id = 6764;
select 'arts|' || count(a.id) || '|' || count(a.id) filter (where a.published_at is null) || '|' || coalesce(max(a.fetched_at)::text, '-') || '|' || coalesce(f.last_status, '-') || '|' || coalesce(left(f.last_error, 200), '-')
from feeds f left join articles a on a.feed_id = f.id where f.feed_url = 'https://www.citinewsroom.com/' group by f.id;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 6764),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id = 6764),
  (select count(*) from feeds where publisher_id = 6764),
  (select count(*) from articles where publisher_id = 6764)));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 6764 AND feed_url = 'https://www.citinewsroom.com/') THEN
    RAISE EXCEPTION 'nothing to reverse: the new Citi source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 6764) <> 2 THEN
    RAISE EXCEPTION 'publisher 6764 has sources other than the two expected'; END IF;
END $$;
DELETE FROM articles WHERE feed_id = (SELECT id FROM feeds WHERE feed_url = 'https://www.citinewsroom.com/');
DELETE FROM feeds WHERE feed_url = 'https://www.citinewsroom.com/';
UPDATE feeds SET enabled = true WHERE id = 6764;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 6764),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id = 6764),
  (select count(*) from feeds where publisher_id = 6764),
  (select count(*) from articles where publisher_id = 6764)));
ROLLBACK;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 6764),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id = 6764),
  (select count(*) from feeds where publisher_id = 6764),
  (select count(*) from articles where publisher_id = 6764)));
