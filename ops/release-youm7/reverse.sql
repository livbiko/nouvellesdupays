-- Reverse of apply.sql: Youm7 back to approved-not-activated, exactly as before (values from before.txt).
-- Deletes the RSS source and the articles it stored (Youm7's only articles).
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 8954 AND feed_url = 'https://www.youm7.com/rss/SectionRss?SectionID=65') THEN
    RAISE EXCEPTION 'nothing to reverse: the Youm7 RSS source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 8954) <> 2 THEN
    RAISE EXCEPTION 'publisher 8954 has sources other than the two expected'; END IF;
END $$;
DELETE FROM articles WHERE feed_id = (SELECT id FROM feeds WHERE feed_url = 'https://www.youm7.com/rss/SectionRss?SectionID=65');
DELETE FROM feeds WHERE feed_url = 'https://www.youm7.com/rss/SectionRss?SectionID=65';
UPDATE feeds SET enabled = true WHERE id = 8952;
UPDATE publishers SET feed_status = 'pending' WHERE id = 8954;
UPDATE publisher_submissions
   SET status = 'approved', status_changed_at = '2026-10-12T12:31:08.03395+00:00'::timestamptz,
       reviewer_note = 'Approved 2026-10-12 but not activated: 8 of 10 article pages give no usable headline to our crawler and its RSS dates are in Arabic text. Needs a parser change before activation.'
 WHERE id = 164;
COMMIT;
