-- Reverses CR-2026-11-16-04: creators 515-517 (CI) back to candidate / REQUIRES_REVIEW, their reviewer-decision
-- evidence rows (creator_verifications 38-40) deleted. Kind, country, categories and accounts were not changed.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM creator_verifications WHERE id IN (38, 39, 40) AND evidence_kind = 'reviewer' AND creator_id IN (515, 516, 517);
UPDATE creators SET review_status = 'candidate', approved_at = NULL, confidence = 'REQUIRES_REVIEW', updated_at = now()
 WHERE id IN (515, 516, 517);
SELECT id, review_status, confidence FROM creators WHERE id IN (515, 516, 517) ORDER BY id;
COMMIT;
