-- Reverses the Mothership correction: puts label_time_zone back on feed 998. To restore article dates, set published_at
-- from the values printed between ===ROWS-BEGIN=== and ===ROWS-END=== in the apply output (kept in the recovery point).
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Asia/Singapore"}'::jsonb WHERE id = 998;
COMMIT;
