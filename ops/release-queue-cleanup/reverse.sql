-- Exact reverse of cleanup.sql (states from snapshot-before.txt / p202-before.txt).
-- Copy articles-8886-8890.csv to /tmp in the postgres pod first.
\set ON_ERROR_STOP on
BEGIN;
-- 4. un-reject the 21 (original statuses: submitted for 77,84,88,90,93; pending for the rest)
UPDATE publisher_submissions SET status = CASE WHEN id IN (77,84,88,90,93) THEN 'submitted' ELSE 'pending' END,
  reviewer_note = NULL, reviewed_at = NULL
  WHERE id IN (51,56,57,61,62,63,64,67,68,69,71,72,73,77,82,83,84,88,90,93,98) AND status = 'rejected';
UPDATE discovered_sources SET status = 'verified',
  notes = CASE WHEN notes LIKE 'rejected 2026-10-09:%' AND strpos(notes, E'\n') = 0 THEN NULL
               WHEN strpos(notes, E'\nrejected 2026-10-09:') > 0 THEN left(notes, strpos(notes, E'\nrejected 2026-10-09:') - 1)
               ELSE notes END
  WHERE id IN (284,285,281,197,275,271,268,211,293,194,277,216,201,304,256,237,305,274,309,259,212,254,290,258) AND status = 'rejected';
-- 3. Bénin Intelligent back to the merged state
UPDATE publisher_submissions SET status = 'approved', publisher_id = 202, reviewer_note = NULL WHERE id = 45;
UPDATE publishers SET homepage_url = 'https://beninintelligent.bj/' WHERE id = 202;
INSERT INTO feeds (id, publisher_id, feed_url, feed_type) VALUES (8883, 202, 'https://beninintelligent.bj/feed/', 'rss') ON CONFLICT DO NOTHING;
-- 2. un-suspend and restore the 4 articles
UPDATE publisher_submissions SET status = 'approved', reviewer_note = NULL WHERE id IN (46, 53);
UPDATE publishers SET feed_status = 'active' WHERE id IN (8886, 8890);
\copy articles FROM '/tmp/articles-8886-8890.csv' WITH CSV HEADER
-- 1. Ivoirematin back to Senegal
UPDATE publishers SET country_id = (SELECT id FROM countries WHERE iso_code = 'SN') WHERE id = 8880;
UPDATE publisher_submissions SET country_id = (SELECT id FROM countries WHERE iso_code = 'SN') WHERE id = 40;
UPDATE discovered_sources SET country_id = (SELECT id FROM countries WHERE iso_code = 'SN'),
  flags = CASE WHEN 'country_from_referrer' = ANY (flags) THEN flags ELSE array_append(flags, 'country_from_referrer') END WHERE id = 300;
UPDATE articles SET country_id = (SELECT id FROM countries WHERE iso_code = 'SN') WHERE publisher_id = 8880;
COMMIT;
