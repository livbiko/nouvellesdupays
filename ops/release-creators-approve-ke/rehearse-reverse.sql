-- Reverses Build #257 (owner 11-15: "132, 142, 138 yes, rest no"): the 3 Kenyan creators approved through the admin
-- API go back to candidate / REQUIRES_REVIEW / individual (as before), and their reviewer-decision evidence rows
-- (creator_verifications 34-36) are deleted. Categories were not changed.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM creator_verifications WHERE id IN (34, 35, 36) AND evidence_kind = 'reviewer' AND creator_id IN (132, 142, 138);
UPDATE creators SET review_status = 'candidate', approved_at = NULL, confidence = 'REQUIRES_REVIEW', creator_kind = 'individual',
       updated_at = now() WHERE id IN (132, 142, 138);
SELECT id, review_status, confidence, creator_kind FROM creators WHERE id IN (132, 142, 138) ORDER BY id;
ROLLBACK;
