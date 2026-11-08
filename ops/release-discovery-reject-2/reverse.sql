-- Undo Build #192: put the 4 back in the review queue and strip the note prefix it added.
BEGIN;
UPDATE discovered_sources SET status = 'under_review', updated_at = now(),
    notes = nullif(regexp_replace(notes, '^rejected 2026-11-08: [^\n]*\n?', ''), '')
  WHERE id IN (144, 570, 727, 597) AND status = 'rejected';
COMMIT;
