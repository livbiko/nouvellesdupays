-- Build #200 rollback: KOACI feed 7292 back to the general sitemap, as it was before (it stored nothing that way).
-- Articles stored by the crawl stay; delete them separately only if wanted (feed_id = 7292).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET feed_url = 'https://www.koaci.com/sitemap.xml', feed_type = 'sitemap-news',
                 article_url_patterns = '{}', allowed_domains = '{}',
                 parser_config = parser_config - 'undated' - 'title_suffix', etag = NULL, last_modified = NULL
  WHERE id = 7292 AND feed_url = 'https://www.koaci.com/';
SELECT id, feed_url, feed_type, article_url_patterns, allowed_domains, parser_config FROM feeds WHERE id = 7292;
COMMIT;
