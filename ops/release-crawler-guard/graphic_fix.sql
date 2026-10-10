-- Daily Graphic (publisher 8915): keep only article URLs, remove section/search pages already stored.
-- Junk rows are copied to /tmp/graphic-junk.csv (in the postgres pod) inside the same transaction.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 8915 AND feed_type = 'html' AND article_url_patterns = '{}') <> 1 THEN
    RAISE EXCEPTION 'Graphic feed not in the expected state (html, no patterns) - nothing changed';
  END IF;
END $$;
CREATE TEMP TABLE junk ON COMMIT DROP AS
  SELECT * FROM articles WHERE publisher_id = 8915
    AND original_url !~ '^https?://(www\.)?graphic\.com\.gh/((news|business|sports|entertainment)/[^/]+/[^/]+|daily-graphic-editorials/[^/]+)';
\copy (SELECT * FROM junk ORDER BY id) TO '/tmp/graphic-junk.csv' WITH CSV HEADER
UPDATE feeds SET article_url_patterns = ARRAY['/news/*/*', '/business/*/*', '/sports/*/*', '/entertainment/*/*', '/daily-graphic-editorials/*']
  WHERE publisher_id = 8915;
DELETE FROM articles WHERE id IN (SELECT id FROM junk);
SELECT 'graphic_removed', count(*), string_agg(left(headline, 40), ' | ') FROM junk;
SELECT 'graphic_kept', count(*) FROM articles WHERE publisher_id = 8915;
COMMIT;
