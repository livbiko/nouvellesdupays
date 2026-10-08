-- Exact reverse of add_crawled_sources.sql.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM articles WHERE publisher_id IN (SELECT id FROM publishers WHERE domain IN ('sonna.so', 'garoweonline.com'));
DELETE FROM feeds WHERE feed_url IN ('https://sonna.so/en', 'https://www.garoweonline.com/en');
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT id FROM publishers WHERE domain IN ('sonna.so', 'garoweonline.com'));
DELETE FROM publishers WHERE domain IN ('sonna.so', 'garoweonline.com');
COMMIT;
