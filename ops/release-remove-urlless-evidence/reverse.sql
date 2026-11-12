-- Build #232 reverse: put back both rows exactly as they were (ids, times) and the 'verified' account state they set.
BEGIN;
INSERT INTO creator_verifications (id, creator_id, social_account_id, evidence_kind, evidence_url, note, recorded_by, created_at) VALUES
  (3, 26, 1207, 'cross_link', NULL, NULL, 'admin', '2026-11-11 16:22:43.48495+00'),
  (7, 24, 1205, 'cross_link', NULL, NULL, 'admin', '2026-11-11 23:36:34.889434+00')
ON CONFLICT (id) DO NOTHING;
UPDATE social_accounts SET verification = 'verified', updated_at = now() WHERE id IN (1205, 1207) AND verification <> 'rejected';
SELECT id, verification FROM social_accounts WHERE id IN (1205, 1207) ORDER BY id;
COMMIT;
