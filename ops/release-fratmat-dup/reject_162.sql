-- Reject discovered_sources 162 (second Fraternité Matin entry; publisher 7293 already carries fratmat.info).
-- Owner request 2026-10-09. One guarded transaction.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM discovered_sources WHERE id = 162 AND domain IS NULL AND homepage_url ILIKE '%fratmat.info%'
                 AND status = 'under_review' AND 'duplicate_domain' = ANY (flags)) THEN
    RAISE EXCEPTION 'row 162 is not in the expected state - nothing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM invitations WHERE discovered_source_id = 162) THEN
    RAISE EXCEPTION 'row 162 has invitations - not rejecting';
  END IF;
END $$;
UPDATE discovered_sources
SET status = 'rejected',
    notes = concat_ws(E'\n', notes, 'rejected 2026-10-09 (owner): duplicate of fratmat.info, already publisher 7293 (Fraternité Matin)'),
    updated_at = now()
WHERE id = 162;
SELECT id, status, array_to_string(flags, ',') FROM discovered_sources WHERE id = 162;
COMMIT;
