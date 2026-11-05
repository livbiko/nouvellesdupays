-- Reverses the Build #166 data step: publisher 229 back to depechesdebrazzaville.fr, unavailable, previous feed state.
-- Articles fetched after the recovery stay (real Dépêches items); remove with publisher_id = 229 AND fetched_at > apply time if needed.
\set ON_ERROR_STOP on
BEGIN;
UPDATE publishers SET homepage_url = 'https://depechesdebrazzaville.fr', domain = 'depechesdebrazzaville.fr', feed_status = 'unavailable' WHERE id = 229;
UPDATE feeds SET feed_url = 'https://depechesdebrazzaville.fr/feed/', last_status = 'error: fetch failed', last_error = 'fetch failed',
  last_error_at = '2026-10-08 02:25:15.386516+00', consecutive_failures = 1562, etag = NULL, last_modified = NULL, parser_config = '{}'::jsonb
  WHERE id = 229;
COMMIT;
