-- Undo Build #191: put the 8 back in the review queue and strip the note prefix it added.
BEGIN;
UPDATE discovered_sources SET status = 'under_review', updated_at = now(),
    notes = nullif(regexp_replace(notes, '^rejected 2026-11-07: [^\n]*\n?', ''), '')
  WHERE id IN (601, 893, 776, 591, 111, 142, 653, 584) AND status = 'rejected';
COMMIT;
