-- Build #238 reverse: restore 87/97's previous creator_kind from the note, put 92 back to candidate; strips only the added notes.
-- (92's note matches the Build #237 reverse pattern too; either reverse restores it.)
BEGIN;
UPDATE creators SET creator_kind = substring(reviewer_note from 'Marque média \(propriétaire, 2026-11-12, ancien type : ([a-z_]+)\)$'),
       reviewer_note = nullif(regexp_replace(reviewer_note, '( \| )?Marque média \(propriétaire, 2026-11-12, ancien type : [a-z_]+\)$', ''), ''),
       updated_at = now()
 WHERE id IN (87, 97) AND reviewer_note ~ 'Marque média \(propriétaire, 2026-11-12, ancien type : [a-z_]+\)$';
UPDATE creators SET review_status = 'candidate', updated_at = now(),
       reviewer_note = nullif(regexp_replace(reviewer_note, '( \| )?Rejeté par le propriétaire le 2026-11-12 \(objet incertain\)$', ''), '')
 WHERE id = 92 AND review_status = 'rejected' AND reviewer_note LIKE '%Rejeté par le propriétaire le 2026-11-12 (objet incertain)';
SELECT review_status, creator_kind, count(*) FROM creators GROUP BY 1, 2 ORDER BY 1, 2;
COMMIT;
