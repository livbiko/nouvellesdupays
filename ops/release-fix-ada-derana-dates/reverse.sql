-- Reverses Build #166 part 1: removes the undated option from feed 1012 and sets published_at back to NULL on the
-- backfilled rows (they are the rows whose published_at equals fetched_at exactly; the id list printed by apply.sql is
-- in the recovery-point folder as ada-derana-ids.txt if an exact list is needed).
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = parser_config - 'undated' WHERE id = 1012;
UPDATE articles SET published_at = NULL WHERE publisher_id = 1012 AND published_at = fetched_at AND fetched_at < '2026-11-05 14:00Z';
COMMIT;
