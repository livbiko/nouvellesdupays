-- Reverses Build #262: drop the time-zone option and move the Fraternité Matin articles stored before 2026-11-16 12:18:14
-- UTC back 2 h (articles stored after the fix were dated correctly by the worker and stay as they are).
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = parser_config - 'label_time_zone' WHERE id = 10253;
UPDATE articles SET published_at = published_at - interval '2 hours'
 WHERE publisher_id = 7293 AND fetched_at < '2026-11-16 12:18:14+00';
SELECT parser_config FROM feeds WHERE id = 10253;
COMMIT;
