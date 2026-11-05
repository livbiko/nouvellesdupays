-- Build #167 data step (MEDIUM): recover Les Dépêches de Brazzaville (CG, publisher 229) on adiac-congo.com.
-- depechesdebrazzaville.fr no longer resolves (1,562 failed fetches since 10-08); the paper's site is adiac-congo.com
-- (ADIAC), feed flux_rss_home. Its item dates are day-first local time ("05-11-2026 10:52"), so the feed gets
-- parser_config {label_time_zone: Africa/Brazzaville, day_first: true}. APPLY ONLY once the worker image that reads
-- day_first is live (commit fcda7f3, poll.js passes dayFirst), or items are dropped or stored undated.
-- Owner, 2026-11-05: "do B". Record and ids kept. rehearse.sql = ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 229 AND slug = 'depeches-de-brazzaville' AND domain = 'depechesdebrazzaville.fr' AND feed_status = 'unavailable')
     OR EXISTS (SELECT 1 FROM publishers WHERE domain = 'adiac-congo.com') THEN
    RAISE EXCEPTION 'Publisher 229 is not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET homepage_url = 'https://www.adiac-congo.com/', domain = 'adiac-congo.com', feed_status = 'active' WHERE id = 229;
UPDATE feeds SET feed_url = 'https://www.adiac-congo.com/flux_rss_home', last_status = NULL, last_error = NULL, last_error_at = NULL,
  consecutive_failures = 0, etag = NULL, last_modified = NULL,
  parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Africa/Brazzaville", "day_first": true}'::jsonb
  WHERE id = 229 AND publisher_id = 229;
SELECT p.id, p.slug, p.domain, p.feed_status, f.feed_url, f.parser_config FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 229;
COMMIT;
