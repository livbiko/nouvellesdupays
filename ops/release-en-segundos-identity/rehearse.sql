-- REHEARSAL (ROLLBACK). -- En Segundos (PA, publisher 9825, feed 9844): its server labels a plain XML body as gzip, so every poll fails with
-- Z_DATA_ERROR. Sets parser_config accept_encoding = 'identity' (worker option from commit 499b407). Apply only once the
-- worker image contains that commit -- an older worker ignores the key, so applying early is harmless but does nothing.
-- Also points the feed at the non-www host it redirects to. Owner, 2026-11-05: "do A, B and C". rehearse.sql = ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id
                 WHERE f.id = 9844 AND p.slug = 'en-segundos' AND f.feed_url = 'https://www.ensegundos.com.pa/feed/'
                   AND NOT coalesce(f.parser_config, '{}'::jsonb) ? 'accept_encoding') THEN
    RAISE EXCEPTION 'En Segundos feed 9844 not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"accept_encoding": "identity"}'::jsonb,
                 feed_url = 'https://ensegundos.com.pa/feed/'
 WHERE id = 9844;
SELECT 'feed', id, feed_url, parser_config FROM feeds WHERE id = 9844;
ROLLBACK;
