-- Build #232: remove the two cross_link evidence rows the admin page saved without a URL (11-11 16:22 on Le Journal de
-- Dakar, 23:36 on Dakar Matin); they made the public page claim cross-links that do not exist. Dakar Matin stays approved
-- on its official_website evidence (Build #230). Expected: DELETE 2, UPDATE 1, UPDATE 1.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Only the two rows checked on 11-12: admin cross_link, no URL, no note, on the expected creator/account.
DELETE FROM creator_verifications
 WHERE (id, creator_id, social_account_id) IN ((7, 24, 1205), (3, 26, 1207))
   AND evidence_kind = 'cross_link' AND evidence_url IS NULL AND note IS NULL AND recorded_by = 'admin';
-- Account state from the evidence that remains (same mapping as the admin page): 1205 official_website -> linked_from_site;
-- 1207 has none left -> unverified. Only while still 'verified' (the state those rows set).
UPDATE social_accounts SET verification = 'linked_from_site', updated_at = now() WHERE id = 1205 AND verification = 'verified';
UPDATE social_accounts SET verification = 'unverified', updated_at = now() WHERE id = 1207 AND verification = 'verified'
   AND NOT EXISTS (SELECT 1 FROM creator_verifications WHERE social_account_id = 1207);
SELECT v.id, v.creator_id, v.evidence_kind, v.evidence_url FROM creator_verifications v WHERE v.creator_id IN (24, 26) ORDER BY v.id;
SELECT id, verification FROM social_accounts WHERE id IN (1205, 1207) ORDER BY id;
COMMIT;
