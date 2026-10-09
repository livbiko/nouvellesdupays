-- Discovery queue cleanup, owner request 2026-10-09 ("yes, fix them all").
-- Same effects as the admin actions (suspend / reject), plus two repairs.
-- Every row is guarded against snapshot-before.txt / p202-before.txt; one transaction.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE rej (sub int, cand int, reason text) ON COMMIT DROP;
INSERT INTO rej VALUES
 (51, 284, 'NAN photo gallery; NAN is already a publisher.'),
 (56, 285, 'Pension fund company, not news.'),
 (57, 281, 'Press-release wire, not reporting.'),
 (61, 197, 'Showbiz site; feed dead since Nov 2025.'),
 (62, 275, 'Public financial institution (CDC-CI), not news.'),
 (63, 271, 'Bank, not news.'),
 (64, 268, 'Microfinance company, not news.'),
 (67, 211, 'Press centre; feed dead since May 2025.'),
 (68, 293, 'Sports site; feed dead since April 2026.'),
 (69, 194, 'Joy/Multimedia group TV portal; the group is already covered.'),
 (71, 277, 'NGO site; last item 2024.'),
 (72, 216, 'Feed dead since April 2026.'),
 (73, 201, 'Internet provider; last post 2020.'),
 (77, 304, 'Insurance company, not news.'),
 (82, 256, 'Charity; last post 2017.'),
 (83, 237, 'Microfinance school; last post 2017.'),
 (84, 305, 'Mobile operator, not news.'),
 (88, 274, 'Port authority, not news.'),
 (90, 309, 'Bank, not news.'),
 (93, 259, 'Dutch press-freedom NGO, not an African outlet.'),
 (98, 212, 'Redirects to another site.');

SELECT id FROM publisher_submissions WHERE id IN (40,45,46,53) OR id IN (SELECT sub FROM rej) FOR UPDATE;
DO $$
DECLARE bad text;
BEGIN
  IF (SELECT count(*) FROM publisher_submissions s JOIN rej ON rej.sub = s.id WHERE s.status IN ('pending','submitted')) <> 21 THEN
    RAISE EXCEPTION 'not all 21 submissions are still pending/submitted - nothing changed';
  END IF;
  IF (SELECT count(*) FROM discovered_sources d JOIN rej ON rej.cand = d.id AND d.promoted_submission_id = rej.sub WHERE d.status = 'verified') <> 21 THEN
    RAISE EXCEPTION 'candidate/submission links differ from the snapshot - nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 40 AND status = 'approved' AND publisher_id = 8880)
     OR NOT EXISTS (SELECT 1 FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.id = 8880 AND c.iso_code = 'SN')
     OR EXISTS (SELECT 1 FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'CI'
                AND (p.name = 'Ivoirematin' OR lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1)) = 'ivoirematin.com')) THEN
    RAISE EXCEPTION 'Ivoirematin not in the expected state - nothing changed';
  END IF;
  IF (SELECT count(*) FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
      WHERE (s.id, p.id) IN ((46, 8886), (53, 8890)) AND s.status = 'approved' AND p.feed_status = 'active') <> 2 THEN
    RAISE EXCEPTION 'LONAGUI / fatwa council not in the expected state - nothing changed';
  END IF;
  IF (SELECT count(*) FROM articles WHERE publisher_id IN (8886, 8890)) <> 4 THEN
    RAISE EXCEPTION 'article count for 8886/8890 changed since the backup - nothing changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 202 AND homepage_url = 'https://beninintelligent.bj/')
     OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8883 AND publisher_id = 202 AND feed_url = 'https://beninintelligent.bj/feed/')
     OR EXISTS (SELECT 1 FROM articles WHERE feed_id = 8883)
     OR NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 45 AND status = 'approved' AND publisher_id = 202) THEN
    RAISE EXCEPTION 'Benin Intelligent (202 / feed 8883 / submission 45) not in the expected state - nothing changed';
  END IF;
END $$;

-- 1. Ivoirematin is Ivorian: move it, its submission, its candidate and its articles to Côte d'Ivoire.
UPDATE publishers SET country_id = (SELECT id FROM countries WHERE iso_code = 'CI') WHERE id = 8880;
UPDATE publisher_submissions SET country_id = (SELECT id FROM countries WHERE iso_code = 'CI') WHERE id = 40;
UPDATE discovered_sources SET country_id = (SELECT id FROM countries WHERE iso_code = 'CI'),
  flags = array_remove(flags, 'country_from_referrer'), updated_at = now() WHERE id = 300;
UPDATE articles SET country_id = (SELECT id FROM countries WHERE iso_code = 'CI') WHERE publisher_id = 8880;

-- 2. Suspend LONAGUI (lottery, posts casino spam) and the Mauritanian fatwa council (government body).
UPDATE publisher_submissions SET status = 'suspended', status_changed_at = now(),
  reviewer_note = CASE id WHEN 46 THEN 'Suspended 2026-10-09: national lottery, not news; its feed carried casino spam.'
                          ELSE 'Suspended 2026-10-09: government body (fatwa/grievances council), not a news outlet.' END
  WHERE id IN (46, 53);
UPDATE publishers SET feed_status = 'suspended' WHERE id IN (8886, 8890);
DELETE FROM articles WHERE publisher_id IN (8886, 8890);  -- 4 rows, saved in articles-8886-8890.csv
UPDATE discovered_sources SET status = 'rejected', updated_at = now(),
  notes = concat_ws(E'\n', notes, CASE id WHEN 254 THEN 'rejected 2026-10-09: national lottery (casino spam in feed)'
                                         ELSE 'rejected 2026-10-09: government body, not news' END)
  WHERE id IN (254, 290);

-- 3. Bénin Intelligent: the .bj approval matched publisher 202 (beninintelligent.com) by name and repointed it.
DELETE FROM feeds WHERE id = 8883;  -- the .bj feed, 0 articles
UPDATE publishers SET homepage_url = 'https://beninintelligent.com' WHERE id = 202;
UPDATE publisher_submissions SET status = 'rejected', status_changed_at = now(), publisher_id = NULL,
  reviewer_note = 'Rejected 2026-10-09: duplicate of publisher 202 (beninintelligent.com). Approval had merged it by name; publisher 202 restored, .bj feed removed.'
  WHERE id = 45;
UPDATE discovered_sources SET status = 'rejected', updated_at = now(),
  notes = concat_ws(E'\n', notes, 'rejected 2026-10-09: duplicate of publisher 202 (beninintelligent.com)') WHERE id = 258;

-- 4. Reject the 21 waiting submissions, each with its reason.
UPDATE publisher_submissions s SET status = 'rejected', reviewer_note = 'Rejected 2026-10-09: ' || rej.reason,
  reviewed_at = now(), status_changed_at = now()
  FROM rej WHERE rej.sub = s.id;
UPDATE discovered_sources d SET status = 'rejected', updated_at = now(),
  notes = concat_ws(E'\n', d.notes, 'rejected 2026-10-09: ' || rej.reason)
  FROM rej WHERE rej.cand = d.id;

SELECT 'subs', status, count(*) FROM publisher_submissions WHERE id IN (40,45,46,53) OR id IN (SELECT sub FROM rej) GROUP BY status ORDER BY 2;
SELECT 'ivoirematin', c.iso_code, (SELECT count(*) FROM articles a WHERE a.publisher_id = 8880 AND a.country_id = c.id) FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.id = 8880;
SELECT 'p202', homepage_url, (SELECT count(*) FROM feeds WHERE publisher_id = 202), feed_status FROM publishers WHERE id = 202;
SELECT 'suspended', id, feed_status, (SELECT count(*) FROM articles a WHERE a.publisher_id = publishers.id) FROM publishers WHERE id IN (8886, 8890) ORDER BY id;
COMMIT;
