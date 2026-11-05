-- Reverses the BBC Persian date fix: removes the undated option from feed 10173. To restore NULL dates, set
-- published_at = NULL for the ids printed between ===IDS-BEGIN=== and ===IDS-END=== in the apply output.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = parser_config - 'undated' WHERE id = 10173;
COMMIT;
