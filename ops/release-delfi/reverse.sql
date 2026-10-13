-- Reverse of apply.sql: old Delfi feed re-enabled, the new source and the articles it stored deleted.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 577 AND feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss') THEN
    RAISE EXCEPTION 'nothing to reverse: the new Delfi source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 577) <> 2 THEN
    RAISE EXCEPTION 'publisher 577 has sources other than the two expected'; END IF;
END $$;
DELETE FROM articles WHERE feed_id = (SELECT id FROM feeds WHERE feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss');
DELETE FROM feeds WHERE feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss';
UPDATE feeds SET enabled = true WHERE id = 577;
COMMIT;
