-- Build #200: KOACI (CI, feed 7292) has never stored an article: its feed is the site's general sitemap.xml
-- (25 MB, 72,580 URLs, no news entries, last lastmod 2026-10-26), read as a news sitemap. KOACI has no RSS and no
-- news sitemap. A dry-run HTML crawl of the homepage (11-08) found 58 /article/YYYY/MM/DD/... links and extracted
-- title, summary and image for each; the pages carry no machine-readable date and every title ends in " - KOACI".
-- Owner: don't disable the feed; "go ahead with Build #200". Get-ChangeRisk MEDIUM.
-- rehearse.sql is this file with ROLLBACK; reverse.sql restores the sitemap settings.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.category_urls, f.article_url_patterns, f.allowed_domains,
       f.respect_robots_txt, f.parser_config, f.etag, f.last_modified FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 7292;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 7292 AND p.slug = 'koaci-com' AND f.feed_type = 'sitemap-news'
                   AND f.feed_url = 'https://www.koaci.com/sitemap.xml' AND f.respect_robots_txt) THEN
    RAISE EXCEPTION 'Feed 7292 is not the KOACI sitemap feed - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://www.koaci.com/', feed_type = 'html',
                 article_url_patterns = ARRAY['/article/*'], allowed_domains = ARRAY['koaci.com'],
                 parser_config = coalesce(parser_config, '{}'::jsonb) || '{"undated": "fetch_time", "title_suffix": " - KOACI"}'::jsonb,
                 etag = NULL, last_modified = NULL
  WHERE id = 7292;
\echo ===AFTER===
SELECT f.id, p.slug, f.feed_url, f.feed_type, f.category_urls, f.article_url_patterns, f.allowed_domains,
       f.respect_robots_txt, f.parser_config, f.etag, f.last_modified FROM feeds f
  JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 7292;
ROLLBACK;
