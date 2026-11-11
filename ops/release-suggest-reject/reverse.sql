-- Build #227 reverse: clear the suggested-reject notes (only the generated text; a reviewer's own note is kept).
BEGIN;
UPDATE creators SET reviewer_note = NULL, updated_at = now()
 WHERE reviewer_note LIKE 'Suggestion : rejeter (%) - détecté sur le nom, à confirmer';
COMMIT;
