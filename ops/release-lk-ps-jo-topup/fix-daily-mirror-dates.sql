-- Build #166 part 2 follow-up: Daily Mirror (LK) writes Sri Lanka local time without a zone ("2026-11-05 18:33:00" = 13:03 UTC).
-- Read as UTC it is 5.5 h in the future, so the worker stored all 12 first items at their fetch time (13:25:07).
-- label_time_zone Asia/Colombo makes the worker read the wall-clock time in that zone; the 12 rows are deleted so the
-- next poll stores them again with the right dates (they are still in the feed). rehearsal = same file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM articles a JOIN publishers p ON p.id = a.publisher_id WHERE p.slug = 'daily-mirror-lk';
  IF n NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Daily Mirror has % articles, expected 1-30 - nothing changed', n; END IF;
END $do$;
UPDATE feeds f SET parser_config = coalesce(f.parser_config, '{}'::jsonb) || '{"label_time_zone": "Asia/Colombo"}'::jsonb
  FROM publishers p WHERE p.id = f.publisher_id AND p.slug = 'daily-mirror-lk';
DELETE FROM articles a USING publishers p WHERE p.id = a.publisher_id AND p.slug = 'daily-mirror-lk';
SELECT f.id, f.parser_config FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.slug = 'daily-mirror-lk';
COMMIT;
