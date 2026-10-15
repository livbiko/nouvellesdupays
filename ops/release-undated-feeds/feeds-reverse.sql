-- Reverse of feeds.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DO $$
DECLARE n int := 0; k int;
BEGIN
  UPDATE feeds SET feed_url = 'https://www.baltictimes.com/feed/', etag = NULL, last_modified = NULL,
         parser_config = parser_config - 'undated' - 'title_suffix'
   WHERE id = 573 AND feed_url = 'https://www.baltictimes.com/rss/'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  UPDATE feeds SET feed_url = 'https://elsalvador.com/rss', etag = NULL, last_modified = NULL
   WHERE id = 1523 AND feed_url = 'https://www.elsalvador.com/sitemap.rss'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  IF n <> 2 THEN RAISE EXCEPTION 'reverse: expected 2 feeds, updated %', n; END IF;
END $$;
COMMIT;
select 'reversed|' || string_agg(id || '=' || feed_url || ' ' || parser_config::text, ' ' ORDER BY id) FROM feeds WHERE id IN (573, 1523);
