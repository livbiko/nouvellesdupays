-- Read-only: config and 2 recent article URLs of the 6 crawled (html) sources whose articles are all undated.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'cfg|' || f.publisher_id || '|' || f.id || '|' || f.feed_url || '|' || coalesce(array_to_string(f.category_urls, ' '), '') || '|' || coalesce(array_to_string(f.article_url_patterns, ' '), '') || '|' || coalesce(array_to_string(f.allowed_domains, ' '), '') || '|' || f.parser_config::text || '|' || coalesce(f.crawl_frequency_minutes::text, '-')
  FROM feeds f WHERE f.publisher_id IN (8918, 8949, 8965, 8950, 8917, 8956) AND f.enabled ORDER BY f.publisher_id;
SELECT 'url|' || publisher_id || '|' || original_url FROM (
  SELECT publisher_id, original_url, row_number() OVER (PARTITION BY publisher_id ORDER BY fetched_at DESC) rn FROM articles WHERE publisher_id IN (8918, 8949, 8965, 8950, 8917, 8956)) s WHERE rn <= 2 ORDER BY publisher_id;
