-- Publisher 1066 was named "OC Media" but has always pointed at on.ge (a different,
-- Georgian-language outlet), so On.ge articles were published under OC Media's name.
-- Fix (keeps articles + dedup hashes consistent): 1066 becomes "On.ge"; a new
-- "OC Media" publisher gets the real oc-media.org feed and OC Media's editorial profile.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 1066 AND name = 'OC Media' AND homepage_url = 'https://on.ge') THEN
    RAISE EXCEPTION 'publisher 1066 is not in the expected state (OC Media -> on.ge)'; END IF;
  IF EXISTS (SELECT 1 FROM publishers WHERE domain = 'oc-media.org') OR EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://oc-media.org/feed/') THEN
    RAISE EXCEPTION 'an oc-media.org publisher/feed already exists'; END IF;
END $$;
UPDATE publishers SET name = 'On.ge', language = 'ka', source_type = 'ONLINE_NEWS' WHERE id = 1066;
INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language, source_type)
  SELECT country_id, 'OC Media', 'https://oc-media.org', 'oc-media.org', 'active', 'en', 'ONLINE_NEWS' FROM publishers WHERE id = 1066;
INSERT INTO feeds (publisher_id, feed_url, feed_type)
  SELECT id, 'https://oc-media.org/feed/', 'rss' FROM publishers WHERE domain = 'oc-media.org';
UPDATE editorial_profiles SET publisher_id = (SELECT id FROM publishers WHERE domain = 'oc-media.org') WHERE publisher_id = 1066;
DO $$ BEGIN
  IF (SELECT name FROM publishers WHERE id = 1066) <> 'On.ge' THEN RAISE EXCEPTION 'rename failed'; END IF;
  IF (SELECT count(*) FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.domain = 'oc-media.org' AND f.feed_url = 'https://oc-media.org/feed/') <> 1 THEN RAISE EXCEPTION 'OC Media feed missing'; END IF;
  IF EXISTS (SELECT 1 FROM editorial_profiles WHERE publisher_id = 1066) THEN RAISE EXCEPTION 'profile still on 1066'; END IF;
END $$;
SELECT p.id, p.name, p.homepage_url, p.language, (SELECT count(*) FROM editorial_profiles e WHERE e.publisher_id = p.id) AS profiles
  FROM publishers p WHERE p.id = 1066 OR p.domain = 'oc-media.org' ORDER BY p.id;
COMMIT;
