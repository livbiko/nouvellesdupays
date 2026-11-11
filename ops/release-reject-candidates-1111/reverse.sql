-- Build #228 reverse: back to candidate for the creators this release rejected; strips only the added note.
BEGIN;
UPDATE creators SET review_status = 'candidate', updated_at = now(),
       reviewer_note = nullif(regexp_replace(reviewer_note, '( \| )?Rejeté par le propriétaire le 2026-11-11 \([^)]*\)$', ''), '')
 WHERE review_status = 'rejected' AND reviewer_note LIKE '%Rejeté par le propriétaire le 2026-11-11 (%)';
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
COMMIT;
