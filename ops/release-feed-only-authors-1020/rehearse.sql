-- Build #196: turn on the Build #195 author allowlist for Business Bhutan (feed 1020): only items by the site's own
-- account 'businessbhutan' are stored (213 of 214 rows in 180 days; the other is spam). Also deletes the
-- "Boomerang Bet Support" row that the 12:25 worker run re-inserted at 12:31, after Build #193 deleted it but before
-- that run saw the new filter. The title filter stays as a second layer. Get-ChangeRisk said HIGH (likely "author"
-- read as auth); run only in the approved window. Owner: "approve the window". rehearse.sql is this file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE tgt (id bigint PRIMARY KEY, action text NOT NULL);
INSERT INTO tgt SELECT id, 'delete-bt-not-allowlisted' FROM articles
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
    AND coalesce(lower(author), '') <> 'businessbhutan';
\echo ===COUNTS===
SELECT action, count(*) FROM tgt GROUP BY 1 ORDER BY 1;
-- Expected on 11-08 14:40: 1 (268516032, wps_ebe76b6454).
DO $do$
DECLARE n_bt int; n_feed int;
BEGIN
  SELECT count(*) INTO n_bt FROM tgt;
  IF n_bt NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Target count outside the expected range (%) - nothing changed', n_bt;
  END IF;
  SELECT count(*) INTO n_feed FROM feeds
    WHERE id = 1020 AND publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
      AND NOT (coalesce(parser_config, '{}'::jsonb) ? 'only_authors');
  IF n_feed <> 1 THEN
    RAISE EXCEPTION 'Feed 1020 is not Business Bhutan or already has only_authors - nothing changed';
  END IF;
END $do$;
\echo ===STATE-BEFORE===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
\echo ===TARGETS===
SELECT t.action, a.id, a.fetched_at, a.author, left(a.headline, 100) FROM articles a JOIN tgt t ON t.id = a.id ORDER BY 1, 3;
\echo ===CSV-BEGIN===
COPY (SELECT t.action, a.* FROM articles a JOIN tgt t ON t.id = a.id ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===CSV-END===
DELETE FROM articles WHERE id IN (SELECT id FROM tgt);
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"only_authors": ["businessbhutan"]}'::jsonb
  WHERE id = 1020;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 1020
                   AND parser_config -> 'only_authors' = '["businessbhutan"]'::jsonb
                   AND parser_config ? 'exclude_title_pattern') THEN
    RAISE EXCEPTION 'Feed 1020 settings were not updated as expected - nothing changed';
  END IF;
END $do$;
\echo ===AFTER===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
SELECT 'left', count(*) FROM articles WHERE id IN (SELECT id FROM tgt);
ROLLBACK;
