-- Exact reverse of fix_ocmedia.sql.
\set ON_ERROR_STOP on
BEGIN;
UPDATE editorial_profiles SET publisher_id = 1066 WHERE publisher_id = (SELECT id FROM publishers WHERE domain = 'oc-media.org');
DELETE FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE domain = 'oc-media.org');
DELETE FROM feeds WHERE feed_url = 'https://oc-media.org/feed/';
DELETE FROM publishers WHERE domain = 'oc-media.org' AND name = 'OC Media';
UPDATE publishers SET name = 'OC Media', language = 'en', source_type = 'OTHER' WHERE id = 1066 AND name = 'On.ge';
SELECT id, name, homepage_url, language, source_type FROM publishers WHERE id = 1066;
COMMIT;
