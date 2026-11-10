-- Reverses Build #210b: re-enables the 8 duplicate feeds.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET enabled = true WHERE id IN (9114, 9190, 9301, 9302, 9306, 9418, 9451, 9455) AND NOT enabled;
SELECT id, enabled FROM feeds WHERE id IN (9114, 9190, 9301, 9302, 9306, 9418, 9451, 9455) ORDER BY id;
COMMIT;
