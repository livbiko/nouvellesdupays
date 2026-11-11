-- Reverse Build #223 migration 019. Remove (or give a country to) region-only candidates first.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM creators WHERE region IS NOT NULL) THEN
    RAISE EXCEPTION 'creators with a region exist - remove the Build #223 candidates first (discovered_from LIKE ''%%country not declared%%'')';
  END IF;
END $do$;
DROP INDEX IF EXISTS idx_creators_region;
DROP INDEX IF EXISTS idx_creators_languages;
ALTER TABLE creators DROP COLUMN IF EXISTS region;
COMMIT;
