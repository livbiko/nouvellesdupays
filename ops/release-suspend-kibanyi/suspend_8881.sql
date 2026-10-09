-- Suspend Kibanyi Guinée (publisher 8881, submission 41) exactly like
-- POST /api/admin/submissions/:id/suspend. Owner request 2026-10-09: its feed
-- answers HTTP 409 to our bot (bot protection), 0 articles. Reversible.
\set ON_ERROR_STOP on
BEGIN;
SELECT s.id, s.status, s.reviewer_note, p.id, p.name, p.feed_status FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id WHERE s.id = 41;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
                 WHERE s.id = 41 AND p.id = 8881 AND p.name = 'Kibanyi Guinée' AND s.status IN ('approved', 'active') AND p.feed_status = 'active') THEN
    RAISE EXCEPTION 'submission 41 / publisher 8881 not in the expected state - nothing changed';
  END IF;
END $$;
UPDATE publisher_submissions SET status = 'suspended', status_changed_at = now(),
  reviewer_note = 'Suspended 2026-10-09 (owner): feed answers HTTP 409 to NouvellesDuPaysBot (bot protection), no articles. Reactivate if the site allows our bot.'
  WHERE id = 41;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 8881;
SELECT s.id, s.status, p.id, p.feed_status FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id WHERE s.id = 41;
COMMIT;
