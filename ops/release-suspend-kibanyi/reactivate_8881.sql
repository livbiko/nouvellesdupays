-- Reverse of suspend_8881.sql (what the admin "activer" action does).
\set ON_ERROR_STOP on
BEGIN;
UPDATE publisher_submissions SET status = 'approved', status_changed_at = now(), reviewer_note = NULL WHERE id = 41 AND status = 'suspended';
UPDATE publishers SET feed_status = 'active' WHERE id = 8881 AND feed_status = 'suspended';
SELECT s.id, s.status, p.feed_status FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id WHERE s.id = 41;
COMMIT;
