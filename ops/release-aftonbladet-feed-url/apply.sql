-- Build #225: Aftonbladet (feed 9984) to its own RSS host; /rss.xml returns 404 since ~12:31 UTC 11-11.
-- Guard: feed 9984 still has the old URL and the new URL is not used by another feed.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 9984 AND feed_url = 'https://www.aftonbladet.se/rss.xml' AND enabled) THEN
    RAISE EXCEPTION 'guard: feed 9984 is not the enabled www.aftonbladet.se/rss.xml feed';
  END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt') THEN
    RAISE EXCEPTION 'guard: new URL already used by another feed';
  END IF;
END $$;
UPDATE feeds SET feed_url = 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt',
       etag = NULL, last_modified = NULL, consecutive_failures = 0
 WHERE id = 9984 AND feed_url = 'https://www.aftonbladet.se/rss.xml';
SELECT id, feed_url, enabled, consecutive_failures, last_status FROM feeds WHERE id = 9984;
COMMIT;
