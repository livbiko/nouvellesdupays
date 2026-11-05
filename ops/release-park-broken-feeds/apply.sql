-- Build #167 (MEDIUM): park long-broken feeds. Owner, 2026-11-05: "mark the 19 unavailable". On checking every feed
-- of the 19 before applying: 11 publishers have no working feed -> feed_status 'unavailable' (records kept);
-- 7 publishers have a working main feed and one broken extra feed -> only that feed is disabled (publisher stays
-- active); Kursiv (KZ) fetched OK today -> left alone. Rechecked monthly. rehearse.sql = ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
CREATE TEMP TABLE park_pub (slug text PRIMARY KEY);
INSERT INTO park_pub VALUES ('arab-news'), ('baltic-times'), ('cnc3'), ('defimedia'), ('el-pais-uy'), ('err-ee'), ('err-news'),
  ('information-dk'), ('medias24'), ('national-post'), ('sloboden-pecat');
CREATE TEMP TABLE park_feed (id int PRIMARY KEY, slug text);
INSERT INTO park_feed VALUES (9527, 'channel-5-belize'), (9531, 'elsalvador-com'), (9258, 'eswatini-observer'), (9176, 'journal-du-tchad'),
  (9308, 'la-stampa'), (9317, 'times-of-malta'), (9246, 'verdade');
DO $do$
DECLARE n int;
BEGIN
  -- every parked publisher is active and none of its feeds is currently ok
  SELECT count(*) INTO n FROM publishers p JOIN park_pub x ON x.slug = p.slug WHERE p.feed_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM feeds f WHERE f.publisher_id = p.id AND f.enabled AND f.last_status NOT LIKE 'error%');
  IF n <> 11 THEN RAISE EXCEPTION 'Expected 11 active publishers with no working feed, found % - nothing changed', n; END IF;
  -- every disabled feed is enabled, failing, belongs to the named publisher, and that publisher keeps another working feed
  SELECT count(*) INTO n FROM feeds f JOIN publishers p ON p.id = f.publisher_id JOIN park_feed x ON x.id = f.id AND x.slug = p.slug
    WHERE f.enabled AND f.last_status LIKE 'error%'
      AND EXISTS (SELECT 1 FROM feeds g WHERE g.publisher_id = p.id AND g.id <> f.id AND g.enabled AND g.last_status NOT LIKE 'error%');
  IF n <> 7 THEN RAISE EXCEPTION 'Expected 7 failing extra feeds with a working sibling, found % - nothing changed', n; END IF;
END $do$;
UPDATE publishers SET feed_status = 'unavailable' WHERE slug IN (SELECT slug FROM park_pub);
UPDATE feeds SET enabled = false WHERE id IN (SELECT id FROM park_feed);
SELECT 'publisher', p.slug, p.feed_status FROM publishers p WHERE p.slug IN (SELECT slug FROM park_pub) ORDER BY 2;
SELECT 'feed', f.id, p.slug, f.enabled, p.feed_status FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id IN (SELECT id FROM park_feed) ORDER BY 2;
COMMIT;
