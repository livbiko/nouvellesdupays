-- Build #164 (MEDIUM): recover Botswana Unplugged (BW, publisher 273). Its feed failed from 10-08 (1,562 fetches) and the
-- publisher was marked unavailable; the same feed answers again (15 items, newest 2026-11-05, robots allows).
-- Owner, 2026-11-05: "recover Unplugged". Same record, same feed URL. rehearse.sql = ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 273 AND slug = 'botswana-unplugged' AND feed_status = 'unavailable') THEN
    RAISE EXCEPTION 'Publisher 273 is not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET feed_status = 'active' WHERE id = 273;
-- etag/last_modified are from September; clear them so the first poll is a full fetch.
UPDATE feeds SET last_status = NULL, last_error = NULL, last_error_at = NULL, consecutive_failures = 0, etag = NULL, last_modified = NULL
  WHERE id = 273 AND publisher_id = 273;
SELECT p.id, p.slug, p.feed_status, f.feed_url, f.consecutive_failures FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 273;
COMMIT;
