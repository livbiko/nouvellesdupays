-- Build #223: migration 019 (creators.region + 2 indexes) on production. rehearse.sql = this file with ROLLBACK;
-- reverse.sql drops them (refuses while a creator has a region).
-- Middle part = db/migrations/019_creators_region.sql verbatim.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
\echo ===STATE-BEFORE===
SELECT count(*) AS creators, count(*) FILTER (WHERE country_id IS NULL) AS without_country FROM creators;
SELECT column_name FROM information_schema.columns WHERE table_name = 'creators' AND column_name = 'region';
-- Build #223 (owner 2026-11-11): YouTube channels found by a country search that declare no country are kept as
-- candidates without a country, grouped by region (of the search) and language. creators.region holds that region
-- (a countries.region value, e.g. 'West Africa'); a creator with a country takes its region from the country.
-- Idempotent: migrate.js re-runs every file.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS idx_creators_region ON creators (region, review_status) WHERE country_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_creators_languages ON creators USING gin (languages);
\echo ===AFTER===
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'creators' AND column_name = 'region';
SELECT indexname FROM pg_indexes WHERE tablename = 'creators' AND indexname IN ('idx_creators_region', 'idx_creators_languages') ORDER BY 1;
ROLLBACK;
