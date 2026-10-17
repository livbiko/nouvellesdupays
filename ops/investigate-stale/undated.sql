-- Read-only: where the undated articles (published_at NULL) of active publishers come from, last 30 days.
-- Undated rows never appear in "latest" lists (NULLS LAST / date-window filters), so they are effectively hidden.
\set ON_ERROR_STOP on
SET statement_timeout = '120s';
SELECT 'total|' || count(*) || '|of ' || (SELECT count(*) FROM articles WHERE fetched_at > now() - interval '30 days') || ' articles in 30 days'
  FROM articles a JOIN publishers p ON p.id = a.publisher_id WHERE p.feed_status = 'active' AND a.published_at IS NULL AND a.fetched_at > now() - interval '30 days';
SELECT 'bytype|' || f.feed_type || '|' || count(*) FROM articles a JOIN feeds f ON f.id = a.feed_id JOIN publishers p ON p.id = a.publisher_id
 WHERE p.feed_status = 'active' AND a.published_at IS NULL AND a.fetched_at > now() - interval '30 days' GROUP BY f.feed_type ORDER BY count(*) DESC;
SELECT 'pub|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || f.feed_type || '|' || count(*) || ' undated|' ||
       (SELECT count(*) FROM articles b WHERE b.publisher_id = p.id AND b.fetched_at > now() - interval '30 days') || ' total|' ||
       coalesce(f.parser_config::text, '{}') || '|' || f.feed_url
  FROM articles a JOIN feeds f ON f.id = a.feed_id JOIN publishers p ON p.id = a.publisher_id JOIN countries c ON c.id = p.country_id
 WHERE p.feed_status = 'active' AND a.published_at IS NULL AND a.fetched_at > now() - interval '30 days'
 GROUP BY p.id, p.name, c.iso_code, f.feed_type, f.parser_config, f.feed_url ORDER BY count(*) DESC LIMIT 40;
