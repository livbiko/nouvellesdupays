-- Undated feeds (data part, MEDIUM): run ONLY after the worker image with 24eaa00 is live, or Baltic Times rows get
-- published_at NULL. 573 Baltic Times: /feed/ -> /rss/ + parser_config undated/title_suffix. 1523 ElSalvador.com:
-- /rss (403) -> /sitemap.rss (dated, pubDate in CDATA). One guarded transaction. Reverse: feeds-reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
select 'before|' || id || '|' || feed_type || '|' || feed_url || '|' || parser_config::text || '|' || consecutive_failures FROM feeds WHERE id IN (573, 1523) ORDER BY id;
DO $$
DECLARE n int := 0; k int;
BEGIN
  UPDATE feeds SET feed_url = 'https://www.baltictimes.com/rss/', etag = NULL, last_modified = NULL, consecutive_failures = 0, last_error = NULL,
         parser_config = coalesce(parser_config, '{}'::jsonb) || '{"undated": "fetch_time", "title_suffix": " - The Baltic Times"}'::jsonb
   WHERE id = 573 AND publisher_id = 573 AND feed_url = 'https://www.baltictimes.com/feed/' AND enabled
     AND NOT coalesce(parser_config, '{}'::jsonb) ?| array['undated', 'title_suffix']; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  UPDATE feeds SET feed_url = 'https://www.elsalvador.com/sitemap.rss', etag = NULL, last_modified = NULL, consecutive_failures = 0, last_error = NULL
   WHERE id = 1523 AND publisher_id = 1523 AND feed_url = 'https://elsalvador.com/rss' AND enabled; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 feeds at their starting values, updated %', n; END IF;
END $$;
select 'after|' || id || '|' || feed_type || '|' || feed_url || '|' || parser_config::text FROM feeds WHERE id IN (573, 1523) ORDER BY id;
COMMIT;
