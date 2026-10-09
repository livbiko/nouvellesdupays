-- Exact reverse of reject_162.sql.
\set ON_ERROR_STOP on
BEGIN;
UPDATE discovered_sources
SET status = 'under_review',
    notes = CASE WHEN strpos(notes, E'\nrejected 2026-10-09 (owner)') > 0 THEN left(notes, strpos(notes, E'\nrejected 2026-10-09 (owner)') - 1)
                 WHEN strpos(notes, 'rejected 2026-10-09 (owner)') = 1 THEN NULL ELSE notes END
WHERE id = 162 AND status = 'rejected';
COMMIT;
