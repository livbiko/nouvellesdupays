-- Exact reverse of fix_gna.sql.
\set ON_ERROR_STOP on
BEGIN;
UPDATE discovered_sources
SET status = 'rejected', health = 'spam_suspect',
    flags = array_append(array_remove(flags, 'compromised'), 'spam'),
    notes = CASE WHEN strpos(notes, E'\nrestored 2026-10-08 (owner-approved)') > 0
                 THEN left(notes, strpos(notes, E'\nrestored 2026-10-08 (owner-approved)') - 1) ELSE notes END
WHERE id = 8 AND domain = 'gna.org.gh';
SELECT id, status, health, array_to_string(flags, ',') FROM discovered_sources WHERE id = 8;
COMMIT;
