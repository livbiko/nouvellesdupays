-- Build #213: AllAfrica: Mauritania (publisher 4224, feed 4224) -> the French AllAfrica feed. The English RDF
-- (allafrica.com/tools/headlines/rdf/mauritania/headlines.rdf) now returns an empty channel; nothing stored since
-- 2026-09-25. fr.allafrica.com's Mauritania RDF has 26 items, newest 2026-11-10, robots.txt allows it, and no feed of
-- ours polls it (checked 11-11). Language en -> fr so the categorizer uses French keywords (poll.js categorize(...,
-- feed.language)); articles do not carry their own language. ETag/Last-Modified are cleared so the first request to
-- the new URL is unconditional. Get-ChangeRisk MEDIUM. rehearse.sql = this file with ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT f.id, f.enabled, f.feed_url, f.etag IS NOT NULL has_etag, f.last_modified, p.language, p.feed_status
FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 4224;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 4224 AND f.publisher_id = 4224 AND f.enabled AND p.feed_status = 'active' AND p.language = 'en'
                   AND f.feed_url = 'https://allafrica.com/tools/headlines/rdf/mauritania/headlines.rdf')
  OR EXISTS (SELECT 1 FROM feeds WHERE feed_url ILIKE '%fr.allafrica.com%mauritania%')
  OR EXISTS (SELECT 1 FROM articles WHERE publisher_id = 4224 AND published_at > now() - interval '14 days') THEN
    RAISE EXCEPTION 'guard failed (feed 4224 changed, French feed already polled, or 4224 storing again) - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://fr.allafrica.com/tools/headlines/rdf/mauritania/headlines.rdf',
                 etag = NULL, last_modified = NULL
WHERE id = 4224;
UPDATE publishers SET language = 'fr' WHERE id = 4224;
\echo ===AFTER===
SELECT f.id, f.enabled, f.feed_url, f.etag, f.last_modified, p.language
FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 4224;
COMMIT;
