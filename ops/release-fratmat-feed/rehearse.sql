-- Build #256 (MEDIUM, owner: "approve Build #256"): give Fraternité Matin (publisher 7293, active, CI top outlet #1, no
-- source and 0 articles) its public "Latest News" RSS feed. Checked 11-15 with the bot UA: robots.txt allows it
-- (only /ajax/ disallowed), 50 items, newest of the day, news sections only. pubDates carry +02:00 - checked after the
-- first poll against first-seen times. Reverse: reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 7293 AND domain = 'fratmat.info' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 7293 is not the active Fraternité Matin'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 7293) THEN RAISE EXCEPTION 'Fraternité Matin already has a source'; END IF;
  IF EXISTS (SELECT 1 FROM articles WHERE publisher_id = 7293) THEN RAISE EXCEPTION 'Fraternité Matin already has articles'; END IF;
END $do$;
INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (7293, 'https://www.fratmat.info/rssFeed/0', 'rss');
SELECT id, publisher_id, feed_url, feed_type, enabled FROM feeds WHERE publisher_id = 7293;
ROLLBACK;
