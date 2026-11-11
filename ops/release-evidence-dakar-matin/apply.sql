-- Build #230: strong evidence (official_website) for creator candidate 24 Dakar Matin, as the admin page records it.
-- Status and confidence unchanged: the owner approves in /admin/creators. Expected: 1 evidence row.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE b230_prev ON COMMIT DROP AS
  SELECT sa.id, sa.verification FROM social_accounts sa JOIN creators cr ON cr.id = sa.creator_id
   WHERE cr.id = 24 AND cr.display_name = 'Dakar Matin' AND cr.review_status = 'candidate'
     AND sa.platform = 'youtube' AND sa.platform_account_id = 'UC8f8PVJ9b0Ah4IKuCfESdag';
SELECT 'account before', id, verification FROM b230_prev;
INSERT INTO creator_verifications (creator_id, social_account_id, evidence_kind, evidence_url, note, recorded_by)
SELECT 24, id, 'official_website', 'https://dakarmatin.com/',
       'Le site dakarmatin.com renvoie vers youtube.com/@dakarmatintv (chaîne UC8f8PVJ9b0Ah4IKuCfESdag), vérifié le 2026-11-11. Ancienne vérification du compte : ' || verification,
       'build-230'
  FROM b230_prev
 WHERE NOT EXISTS (SELECT 1 FROM creator_verifications WHERE creator_id = 24 AND recorded_by = 'build-230');
-- Same as the admin page: official_website -> account linked_from_site, never over a rejection; never downgrade verified.
UPDATE social_accounts SET verification = 'linked_from_site', updated_at = now()
 WHERE id IN (SELECT id FROM b230_prev) AND verification NOT IN ('rejected', 'verified');
SELECT v.id, v.creator_id, v.social_account_id, v.evidence_kind, v.evidence_url, sa.verification
  FROM creator_verifications v JOIN social_accounts sa ON sa.id = v.social_account_id WHERE v.creator_id = 24;
COMMIT;
