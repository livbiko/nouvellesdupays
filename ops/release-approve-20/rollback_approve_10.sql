-- Exact reverse of approve_10.sql (state in publishers-before.txt / check-before.txt).
-- Removes the 10 publishers it created together with their feeds and any
-- articles already polled for them.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE created ON COMMIT DROP AS
  SELECT publisher_id AS id FROM publisher_submissions WHERE id IN (49,55,58,59,60,66,74,132,133,134) AND publisher_id IS NOT NULL;
UPDATE publisher_submissions SET status = 'pending', reviewed_at = NULL, publisher_id = NULL
  WHERE id IN (49,55,58,59,60,66,74,132,133,134);
DELETE FROM articles WHERE publisher_id IN (SELECT id FROM created);
DELETE FROM feeds WHERE publisher_id IN (SELECT id FROM created);
DELETE FROM publishers WHERE id IN (SELECT id FROM created);
UPDATE publisher_submissions SET language = 'en' WHERE id IN (49, 55, 39);
UPDATE publisher_submissions SET name = 'Rádio Morabeza – Site oficial da Rádio Morabeza FM 93.3 Praia – FM 93.7 Santiago, Maio e Fogo – FM 90.7 São Vicente, Santo Antão e São Miguel' WHERE id = 74;
UPDATE publisher_submissions SET name = 'Trust TV | News | In-depth Analysis | Exclusive Interviews' WHERE id = 132;
UPDATE publisher_submissions SET name = 'Hespress Français - Actualités du Maroc' WHERE id = 134;
UPDATE publishers SET language = 'en' WHERE id = 8879;
UPDATE publishers SET source_type = 'OTHER' WHERE id IN (8878,8879,8881,8882,8883,8884,8887,8888,8889,8891);
UPDATE discovered_sources SET status = 'verified',
  notes = CASE WHEN notes = 'approved as publisher 2026-10-09' THEN NULL
               WHEN strpos(notes, E'\napproved as publisher 2026-10-09') > 0 THEN left(notes, strpos(notes, E'\napproved as publisher 2026-10-09') - 1)
               ELSE notes END
  WHERE id IN (217,171,243,15,257,196,4,280,3,218,296,206,172,240,48,36,169,311,321,178) AND status = 'registered';
SELECT count(*) AS pending_again FROM publisher_submissions WHERE id IN (49,55,58,59,60,66,74,132,133,134) AND status = 'pending';
COMMIT;
