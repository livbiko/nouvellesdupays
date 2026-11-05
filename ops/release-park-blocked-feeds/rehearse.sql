-- REHEARSAL (ROLLBACK). -- Park publishers refused by their site, and disable two broken extra feeds (MEDIUM). Owner, 2026-11-05: "do A, B and C".
-- A) 16 publishers with no working feed -> feed_status 'unavailable' (records kept): 14 answer 403 / a Cloudflare challenge
--    to both curl and Node from .51 (checked 21:25 UTC), Press TV resets connections from both servers since 11-02,
--    Rising Nepal refuses .51 since 10-31. Not circumvented; rechecked monthly.
-- B) 2 failing extra feeds whose publisher keeps a working feed -> enabled = false: The Daily Star 9453 (site serves invalid
--    XML, undefined entity), Monaco-Matin 9291 (times out every poll).
-- rehearse.sql = ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
CREATE TEMP TABLE park_pub (slug text PRIMARY KEY);
INSERT INTO park_pub VALUES ('fraternite-benin'), ('newsbook'), ('sun-mv'), ('sun-mv-sunonline'), ('psm-news'), ('eyewitness-news'),
  ('the-guardian-nigeria'), ('aps'), ('nation-news'), ('sunday-standard'), ('15min-lt'), ('news-of-bahrain'), ('khmer-times'),
  ('modern-ghana'), ('press-tv'), ('the-rising-nepal');
CREATE TEMP TABLE park_feed (id int PRIMARY KEY, slug text);
INSERT INTO park_feed VALUES (9453, 'the-daily-star'), (9291, 'monaco-matin');
DO $do$
DECLARE n int;
BEGIN
  -- every parked publisher is active and none of its feeds is currently ok
  SELECT count(*) INTO n FROM publishers p JOIN park_pub x ON x.slug = p.slug WHERE p.feed_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM feeds f WHERE f.publisher_id = p.id AND f.enabled AND f.last_status NOT LIKE 'error%');
  IF n <> 16 THEN RAISE EXCEPTION 'Expected 16 active publishers with no working feed, found % - nothing changed', n; END IF;
  -- every disabled feed is enabled, failing, belongs to the named publisher, and that publisher keeps another working feed
  SELECT count(*) INTO n FROM feeds f JOIN publishers p ON p.id = f.publisher_id JOIN park_feed x ON x.id = f.id AND x.slug = p.slug
    WHERE f.enabled AND f.last_status LIKE 'error%'
      AND EXISTS (SELECT 1 FROM feeds g WHERE g.publisher_id = p.id AND g.id <> f.id AND g.enabled AND g.last_status NOT LIKE 'error%');
  IF n <> 2 THEN RAISE EXCEPTION 'Expected 2 failing extra feeds with a working sibling, found % - nothing changed', n; END IF;
END $do$;
UPDATE publishers SET feed_status = 'unavailable' WHERE slug IN (SELECT slug FROM park_pub);
UPDATE feeds SET enabled = false WHERE id IN (SELECT id FROM park_feed);
SELECT 'publisher', p.slug, p.feed_status FROM publishers p WHERE p.slug IN (SELECT slug FROM park_pub) ORDER BY 2;
SELECT 'feed', f.id, p.slug, f.enabled, p.feed_status FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id IN (SELECT id FROM park_feed) ORDER BY 2;
ROLLBACK;
