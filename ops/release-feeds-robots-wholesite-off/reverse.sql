-- Reverse Build #220: re-enable the 4 robots-blocked feeds.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET enabled = true WHERE id IN (268, 627, 967, 1064) AND NOT enabled;
SELECT id, enabled FROM feeds WHERE id IN (268, 627, 967, 1064) ORDER BY id;
COMMIT;
