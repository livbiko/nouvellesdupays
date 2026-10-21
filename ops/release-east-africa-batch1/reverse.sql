-- Reverse script for Build #123 East Africa batch 1.
-- Removes all 9 publishers and their associated data.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;

DO $do$
DECLARE
  slugs text[] := ARRAY[
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  ];
  pids integer[];
BEGIN
  SELECT array_agg(id) INTO pids FROM publishers WHERE slug = ANY(slugs);
  IF pids IS NULL OR array_length(pids,1) = 0 THEN
    RAISE NOTICE 'No publishers found to reverse — already clean';
    RETURN;
  END IF;
  DELETE FROM social_accounts       WHERE publisher_id = ANY(pids);
  DELETE FROM editorial_profiles    WHERE publisher_id = ANY(pids);
  DELETE FROM feeds                 WHERE publisher_id = ANY(pids);
  UPDATE publisher_submissions SET publisher_id = NULL WHERE publisher_id = ANY(pids);
  DELETE FROM publisher_submissions WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #123 East Africa batch 1]%';
  DELETE FROM publishers            WHERE id = ANY(pids);
  RAISE NOTICE 'Reversed: removed % publishers', array_length(pids,1);
END $do$;

SELECT 'reversed|' || count(*) || ' publishers remain with these slugs'
  FROM publishers WHERE slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  );
COMMIT;
