-- Reverses Build #212: re-enables Le Mauricien's duplicate feed 9263.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET enabled = true WHERE id = 9263 AND NOT enabled;
SELECT id, enabled FROM feeds WHERE id = 9263;
COMMIT;
