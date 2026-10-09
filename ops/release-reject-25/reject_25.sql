-- Reject 25 submissions waiting in Soumissions (shortlist round 2), owner request 2026-10-10.
-- Same as POST /api/admin/submissions/:id/reject (status rejected + reviewer note), candidates -> rejected.
-- Guarded: every row must still be in the status it had in the 00:27 export. One transaction.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE rej (sub int, cand int, was text, reason text) ON COMMIT DROP;
INSERT INTO rej VALUES
 (97, 234, 'submitted', 'Still unclear what it is, no recent articles found; reject unless you know it.'),
 (99, 261, 'pending', 'Mobile operator; last post 2022.'),
 (100, 278, 'pending', 'Satellite-TV seller; last post 2016.'),
 (101, 276, 'pending', 'Domain-name registry, not news.'),
 (102, 166, 'pending', 'Feed dead since March 2024.'),
 (103, 264, 'submitted', 'Mobile operator (Africell).'),
 (104, 272, 'pending', 'Feed dead since Sep 2025; no articles.'),
 (106, 189, 'submitted', 'Radio-hosting platform (RadioKing), not an Ivorian outlet.'),
 (107, 202, 'submitted', 'Stockbroker, not news.'),
 (109, 306, 'submitted', 'Bank.'),
 (110, 270, 'submitted', 'Bank (Société Générale Togo).'),
 (111, 263, 'submitted', 'Mobile operator (Comium).'),
 (112, 207, 'submitted', 'Title is now “Are You Missing Out on the Latest…”: the old Journal du Bendré domain looks taken over.'),
 (113, 310, 'submitted', 'Red Cross games page, not news.'),
 (115, 269, 'submitted', 'Bank (Société Générale CI).'),
 (116, 238, 'submitted', 'International football statistics site, not Burkinabè news.'),
 (118, 312, 'submitted', 'Insurance company.'),
 (119, 291, 'submitted', 'Human-rights commission (public body), not news; homepage empty.'),
 (120, 286, 'submitted', 'Gambling site (“Crazy Time”), not news. Reject first.'),
 (121, 283, 'submitted', 'A WordPress login page (NAN archive); NAN is already a publisher.'),
 (122, 279, 'submitted', 'A WordPress login page; NAN is already a publisher.'),
 (123, 260, 'submitted', 'Transport company.'),
 (125, 165, 'submitted', 'Payment company.'),
 (127, 282, 'submitted', 'A WordPress login page (NAN business); NAN is already a publisher.'),
 (131, 262, 'pending', 'Web/IT company, not news.');
SELECT id FROM publisher_submissions WHERE id IN (97,99,100,101,102,103,104,106,107,109,110,111,112,113,115,116,118,119,120,121,122,123,125,127,131) FOR UPDATE;
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM rej LEFT JOIN publisher_submissions s ON s.id = rej.sub WHERE s.status IS DISTINCT FROM rej.was OR s.publisher_id IS NOT NULL;
  IF bad > 0 THEN RAISE EXCEPTION '% submissions changed since the export (approved, rejected or gone) - nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM rej JOIN discovered_sources d ON d.id = rej.cand WHERE d.promoted_submission_id IS DISTINCT FROM rej.sub OR d.status <> 'verified';
  IF bad > 0 THEN RAISE EXCEPTION '% candidate links differ - nothing changed', bad; END IF;
END $$;
UPDATE publisher_submissions s SET status = 'rejected', reviewer_note = 'Rejected 2026-10-10: ' || rej.reason,
  reviewed_at = now(), status_changed_at = now() FROM rej WHERE rej.sub = s.id;
UPDATE discovered_sources d SET status = 'rejected', updated_at = now(),
  notes = concat_ws(E'
', d.notes, 'rejected 2026-10-10: ' || rej.reason) FROM rej WHERE rej.cand = d.id;
SELECT status, count(*) FROM publisher_submissions WHERE id IN (97,99,100,101,102,103,104,106,107,109,110,111,112,113,115,116,118,119,120,121,122,123,125,127,131) GROUP BY status;
SELECT 'waiting_now', status, count(*) FROM publisher_submissions WHERE status IN ('pending','submitted') GROUP BY status ORDER BY 2;
COMMIT;
