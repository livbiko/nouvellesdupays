-- Reverses Build #256: Fraternité Matin back to no source, the articles that source stored deleted.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM articles WHERE publisher_id = 7293;
DELETE FROM feeds WHERE publisher_id = 7293 AND feed_url = 'https://www.fratmat.info/rssFeed/0';
SELECT count(*) AS feeds_left FROM feeds WHERE publisher_id = 7293;
COMMIT;
