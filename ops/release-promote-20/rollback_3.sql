-- Exact reverse of promote_3.sql (only while the submissions are still pending, i.e. not yet approved).
\set ON_ERROR_STOP on
BEGIN;
WITH gone AS (
  DELETE FROM publisher_submissions s
  USING discovered_sources d
  WHERE d.id IN (48, 169, 321) AND s.id = d.promoted_submission_id AND s.status = 'pending'
    AND s.verification_detail LIKE '%[promoted by Claude on owner request 2026-10-09]'
  RETURNING s.id
)
UPDATE discovered_sources d SET status = 'under_review', promoted_submission_id = NULL,
  language = CASE WHEN d.id = 169 THEN NULL ELSE d.language END
WHERE d.id IN (48, 169, 321) AND d.promoted_submission_id IN (SELECT id FROM gone);
SELECT id, status, promoted_submission_id FROM discovered_sources WHERE id IN (48, 169, 321) ORDER BY id;
COMMIT;
