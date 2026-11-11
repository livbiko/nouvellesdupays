-- Build #229 reverse: restore the previous creator_kind recorded in the note, and strip only the added note.
BEGIN;
UPDATE creators SET creator_kind = substring(reviewer_note from 'Marque média \(propriétaire, 2026-11-11, ancien type : ([a-z_]+)\)$'),
       reviewer_note = nullif(regexp_replace(reviewer_note, '( \| )?Marque média \(propriétaire, 2026-11-11, ancien type : [a-z_]+\)$', ''), ''),
       updated_at = now()
 WHERE reviewer_note ~ 'Marque média \(propriétaire, 2026-11-11, ancien type : [a-z_]+\)$';
SELECT review_status, creator_kind, count(*) FROM creators GROUP BY 1, 2 ORDER BY 1, 2;
COMMIT;
