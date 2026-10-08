-- Exact reverse of add_somali_sources.sql.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM articles WHERE publisher_id IN (SELECT id FROM publishers WHERE domain IN ('hiiraan.com', 'somaliguardian.com', 'somalidispatch.com', 'horseedmedia.net', 'goobjoog.com', 'caasimada.net', 'kaabtv.com'));
DELETE FROM feeds WHERE feed_url IN ('https://hiiraan.com/news.xml', 'https://www.somaliguardian.com/feed/', 'https://www.somalidispatch.com/feed/', 'https://horseedmedia.net/feed/', 'https://goobjoog.com/feed/', 'https://www.caasimada.net/feed/', 'https://kaabtv.com/feed/');
DELETE FROM editorial_profiles WHERE publisher_id IN (SELECT id FROM publishers WHERE domain IN ('hiiraan.com', 'somaliguardian.com', 'somalidispatch.com', 'horseedmedia.net', 'goobjoog.com', 'caasimada.net', 'kaabtv.com'));
DELETE FROM publishers WHERE domain IN ('hiiraan.com', 'somaliguardian.com', 'somalidispatch.com', 'horseedmedia.net', 'goobjoog.com', 'caasimada.net', 'kaabtv.com');
UPDATE publishers SET feed_status = 'active' WHERE id IN (256, 257, 258);
SELECT p.id, p.name, p.feed_status FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'SO' ORDER BY p.id;
COMMIT;
