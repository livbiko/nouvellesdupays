-- Reverse of apply.sql: old Citi feed re-enabled, the new crawled source and the articles it stored deleted.
\set ON_ERROR_STOP on
BEGIN;
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
COMMIT;
