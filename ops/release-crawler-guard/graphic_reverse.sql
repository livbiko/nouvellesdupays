-- Reverse of graphic_fix.sql (needs /tmp/graphic-junk.csv in the postgres pod).
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET article_url_patterns = '{}' WHERE publisher_id = 8915;
\copy articles FROM '/tmp/graphic-junk.csv' WITH CSV HEADER
COMMIT;
