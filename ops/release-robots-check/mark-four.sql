-- Build #222: mark the 4 feeds Build #220 turned off by hand as 'robots_blocked', so the daily robots check turns
-- them back on if their sites lift the whole-site block. Guard: still off, still the 4 Build #220 feeds.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF (SELECT count(*) FROM feeds WHERE id IN (268, 627, 967, 1064) AND NOT enabled) <> 4 THEN
    RAISE EXCEPTION 'guard failed (one of the 4 is on again) - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET last_status = 'robots_blocked', last_error_at = now(),
  last_error = 'robots.txt disallows the whole site for NouvellesDuPaysBot' WHERE id IN (268, 627, 967, 1064);
SELECT id, enabled, last_status FROM feeds WHERE id IN (268, 627, 967, 1064) ORDER BY id;
COMMIT;
