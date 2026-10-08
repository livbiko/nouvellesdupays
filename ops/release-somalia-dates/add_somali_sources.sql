-- Somalia had no working news source (Halbeeg: no feed; Somali Affairs: TLS hostname
-- mismatch; SomaliTalk: newest item 2021). Adds 7 verified, active Somali outlets
-- (3 English, 4 Somali; feeds checked 2026-10-08) and stops polling the 3 dead ones.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE domain IN ('hiiraan.com', 'somaliguardian.com', 'somalidispatch.com', 'horseedmedia.net', 'goobjoog.com', 'caasimada.net', 'kaabtv.com')) OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ('https://hiiraan.com/news.xml', 'https://www.somaliguardian.com/feed/', 'https://www.somalidispatch.com/feed/', 'https://horseedmedia.net/feed/', 'https://goobjoog.com/feed/', 'https://www.caasimada.net/feed/', 'https://kaabtv.com/feed/')) THEN
    RAISE EXCEPTION 'one of the new Somali publishers/feeds already exists'; END IF;
  IF (SELECT count(*) FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'SO' AND p.id IN (256, 257, 258)) <> 3 THEN
    RAISE EXCEPTION 'expected the 3 existing Somali publishers 256/257/258'; END IF;
END $$;
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Hiiraan Online', 'https://www.hiiraan.com', 'hiiraan.com', 'active', 'en', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://hiiraan.com/news.xml', 'rss' FROM publishers WHERE domain = 'hiiraan.com';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Somali Guardian', 'https://www.somaliguardian.com', 'somaliguardian.com', 'active', 'en', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://www.somaliguardian.com/feed/', 'rss' FROM publishers WHERE domain = 'somaliguardian.com';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Somali Dispatch', 'https://www.somalidispatch.com', 'somalidispatch.com', 'active', 'en', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://www.somalidispatch.com/feed/', 'rss' FROM publishers WHERE domain = 'somalidispatch.com';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Horseed Media', 'https://horseedmedia.net', 'horseedmedia.net', 'active', 'so', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://horseedmedia.net/feed/', 'rss' FROM publishers WHERE domain = 'horseedmedia.net';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Goobjoog News', 'https://goobjoog.com', 'goobjoog.com', 'active', 'so', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://goobjoog.com/feed/', 'rss' FROM publishers WHERE domain = 'goobjoog.com';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Caasimada Online', 'https://www.caasimada.net', 'caasimada.net', 'active', 'so', 'ONLINE_NEWS' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://www.caasimada.net/feed/', 'rss' FROM publishers WHERE domain = 'caasimada.net';
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type) SELECT id, 'Kaab TV', 'https://kaabtv.com', 'kaabtv.com', 'active', 'so', 'TV' FROM countries WHERE iso_code = 'SO';
INSERT INTO feeds (publisher_id, feed_url, feed_type) SELECT id, 'https://kaabtv.com/feed/', 'rss' FROM publishers WHERE domain = 'kaabtv.com';
UPDATE publishers SET feed_status = 'unavailable' WHERE id IN (256, 257, 258);
DO $$ BEGIN
  IF (SELECT count(*) FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.domain IN ('hiiraan.com', 'somaliguardian.com', 'somalidispatch.com', 'horseedmedia.net', 'goobjoog.com', 'caasimada.net', 'kaabtv.com')) <> 7 THEN RAISE EXCEPTION 'expected 7 new publishers with feeds'; END IF;
END $$;
SELECT p.id, p.name, p.language, p.feed_status FROM publishers p JOIN countries c ON c.id = p.country_id WHERE c.iso_code = 'SO' ORDER BY p.id;
COMMIT;
