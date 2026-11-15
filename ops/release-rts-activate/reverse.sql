-- Reverses Build #253: RTS back to pending, source option and profile removed, articles it stored deleted.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM articles WHERE publisher_id = 8900;
DELETE FROM editorial_profiles WHERE publisher_id = 8900 AND classification_date = '2026-11-15';
UPDATE feeds SET parser_config = '{}'::jsonb, article_url_patterns = '{}', last_fetched_at = NULL, last_success_at = NULL, last_status = NULL,
       last_error = NULL, last_error_at = NULL, consecutive_failures = 0 WHERE id = 8898;
UPDATE publishers SET feed_status = 'pending', source_type = 'OTHER' WHERE id = 8900;
UPDATE publisher_submissions SET status = 'approved', status_changed_at = now(),
       reviewer_note = nullif(regexp_replace(reviewer_note, E'\\n?Activated 2026-11-15 \\(Build #253\\)[^\\n]*$', ''), '')
 WHERE id = 95;
SELECT p.id, p.feed_status, f.parser_config FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8900;
COMMIT;
