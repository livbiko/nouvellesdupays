-- Build #250 rollback: back to candidate, strips only the note this release added.
BEGIN;
UPDATE creators SET review_status = 'candidate', updated_at = now(),
       reviewer_note = nullif(regexp_replace(reviewer_note, '( \| )?Rejeté par le propriétaire le 2026-11-14 \(groupe B : [^)]*\)$', ''), '')
 WHERE id IN (29, 6, 97, 23, 27, 25, 22, 48, 44) AND review_status = 'rejected'
   AND reviewer_note LIKE '%Rejeté par le propriétaire le 2026-11-14 (groupe B : %';
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
COMMIT;
