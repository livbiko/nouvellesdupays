-- Build #230 reverse: restore the account's previous verification (kept in the note) and delete the evidence row.
BEGIN;
UPDATE social_accounts sa SET verification = substring(v.note from 'Ancienne vérification du compte : ([a-z_]+)$'), updated_at = now()
  FROM creator_verifications v WHERE v.recorded_by = 'build-230' AND v.social_account_id = sa.id
   AND substring(v.note from 'Ancienne vérification du compte : ([a-z_]+)$') IS NOT NULL;
DELETE FROM creator_verifications WHERE recorded_by = 'build-230';
SELECT id, verification FROM social_accounts WHERE creator_id = 24;
COMMIT;
