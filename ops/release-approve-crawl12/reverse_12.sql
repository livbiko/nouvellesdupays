-- Exact reverse of approve_activate_12.sql (state from snapshot-before.txt): removes the 12
-- publishers it created with their crawl sources and any articles already crawled.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE created ON COMMIT DROP AS
  SELECT publisher_id AS id FROM publisher_submissions WHERE id IN (70,76,78,79,80,81,86,87,89,91,92,94) AND publisher_id IS NOT NULL;
UPDATE discovered_sources SET status = 'verified',
  notes = CASE WHEN notes = 'approved as crawled publisher 2026-10-10' THEN NULL
               WHEN strpos(notes, E'\napproved as crawled publisher 2026-10-10') > 0 THEN left(notes, strpos(notes, E'\napproved as crawled publisher 2026-10-10') - 1)
               ELSE notes END
  WHERE id IN (170,7,35,27,28,9,295,20,22,231,220,244) AND status = 'registered';
UPDATE publisher_submissions SET status = 'submitted', reviewed_at = NULL, publisher_id = NULL
  WHERE id IN (70,76,78,79,80,81,86,87,89,91,92,94);
UPDATE publisher_submissions SET name = 'Listen LIVE @ | Trust Radio' WHERE id = 70;
UPDATE publisher_submissions SET name = 'Inforpress (Cabo Verde national news agency)' WHERE id = 80;
UPDATE publisher_submissions SET name = 'Lessor.ml (L''Essor)' WHERE id = 89;
UPDATE publisher_submissions SET name = 'https://www.conakrylive.info/' WHERE id = 94;
DELETE FROM articles WHERE publisher_id IN (SELECT id FROM created);
DELETE FROM feeds WHERE publisher_id IN (SELECT id FROM created);
DELETE FROM publishers WHERE id IN (SELECT id FROM created);
SELECT count(*) AS submitted_again FROM publisher_submissions WHERE id IN (70,76,78,79,80,81,86,87,89,91,92,94) AND status = 'submitted';
COMMIT;
