-- Restore row 8 (Ghana News Agency): the 2026-10-08 auto-reject was a false
-- positive - legitimate agency whose site is hacked (hidden injected spam
-- links). Owner-approved 2026-10-08. One guarded transaction.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM discovered_sources WHERE id = 8 AND domain = 'gna.org.gh' AND status = 'rejected' AND 'spam' = ANY (flags)) THEN
    RAISE EXCEPTION 'row 8 is not in the expected state (gna.org.gh, rejected, spam) - nothing changed';
  END IF;
END $$;
UPDATE discovered_sources
SET status = 'under_review', health = 'ok',
    flags = array_append(array_remove(flags, 'spam'), 'compromised'),
    notes = concat_ws(E'\n', notes, 'restored 2026-10-08 (owner-approved): auto-reject was a false positive - legitimate agency, site compromised (hidden spam links injected); review before promoting'),
    next_check_at = NULL, updated_at = now()
WHERE id = 8;
SELECT id, domain, status, health, array_to_string(flags, ',') FROM discovered_sources WHERE id = 8;
COMMIT;
