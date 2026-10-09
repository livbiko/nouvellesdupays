-- Exact reverse of reject_25.sql (original statuses from the 00:27 export).
\set ON_ERROR_STOP on
BEGIN;
UPDATE publisher_submissions s SET status = v.was, reviewer_note = NULL, reviewed_at = NULL
FROM (VALUES (97, 'submitted'), (99, 'pending'), (100, 'pending'), (101, 'pending'), (102, 'pending'), (103, 'submitted'), (104, 'pending'), (106, 'submitted'), (107, 'submitted'), (109, 'submitted'), (110, 'submitted'), (111, 'submitted'), (112, 'submitted'), (113, 'submitted'), (115, 'submitted'), (116, 'submitted'), (118, 'submitted'), (119, 'submitted'), (120, 'submitted'), (121, 'submitted'), (122, 'submitted'), (123, 'submitted'), (125, 'submitted'), (127, 'submitted'), (131, 'pending')) v(id, was)
WHERE s.id = v.id AND s.status = 'rejected' AND s.reviewer_note LIKE 'Rejected 2026-10-10:%';
UPDATE discovered_sources SET status = 'verified',
  notes = CASE WHEN notes LIKE 'rejected 2026-10-10:%' AND strpos(notes, E'
') = 0 THEN NULL
               WHEN strpos(notes, E'
rejected 2026-10-10:') > 0 THEN left(notes, strpos(notes, E'
rejected 2026-10-10:') - 1)
               ELSE notes END
  WHERE id IN (234,261,278,276,166,264,272,189,202,306,270,263,207,310,269,238,312,291,286,283,279,260,165,282,262) AND status = 'rejected';
COMMIT;
