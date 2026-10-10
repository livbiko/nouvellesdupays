-- Correction to graphic_fix.sql: its URL rule also removed 6 real articles from the
-- /international/... and /features/... sections. Add those sections to the article patterns
-- and restore the 6 articles exactly from /tmp/graphic-junk.csv (same ids, same content).
-- The 7 section/search pages stay removed. One guarded transaction.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE backup (LIKE articles) ON COMMIT DROP;
\copy backup FROM '/tmp/graphic-junk.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM backup) <> 13
     OR (SELECT count(*) FROM backup WHERE id IN (168217220,168348487,168479532,168479533,169572892,169572895)) <> 6
     OR EXISTS (SELECT 1 FROM articles WHERE id IN (168217220,168348487,168479532,168479533,169572892,169572895))
     OR NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 8915 AND article_url_patterns = ARRAY['/news/*/*', '/business/*/*', '/sports/*/*', '/entertainment/*/*', '/daily-graphic-editorials/*']) THEN
    RAISE EXCEPTION 'state differs from the backup / expected patterns - nothing changed';
  END IF;
END $$;
UPDATE feeds SET article_url_patterns = article_url_patterns || ARRAY['/international/*/*', '/features/*/*'] WHERE publisher_id = 8915;
INSERT INTO articles SELECT * FROM backup WHERE id IN (168217220,168348487,168479532,168479533,169572892,169572895)
  AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.dedup_hash = backup.dedup_hash);
SELECT 'restored', count(*) FROM articles WHERE id IN (168217220,168348487,168479532,168479533,169572892,169572895);
SELECT 'patterns', array_to_string(article_url_patterns, ' ') FROM feeds WHERE publisher_id = 8915;
COMMIT;
