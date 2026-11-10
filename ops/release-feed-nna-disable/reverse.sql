-- Reverses Build #209: re-enables NNA's English RSS (feed 9050).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET enabled = true WHERE id = 9050 AND NOT enabled;
SELECT f.id, f.enabled FROM feeds f WHERE f.id = 9050;
COMMIT;
