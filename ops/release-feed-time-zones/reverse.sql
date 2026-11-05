-- Reverses the feed time-zone labels (2026-11-05).
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = parser_config - 'label_time_zone' - 'label_utc_offset_hours' WHERE id IN (1039, 9725, 173, 998);
COMMIT;
