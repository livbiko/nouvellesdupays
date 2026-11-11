-- Build #223 (owner 2026-11-11): YouTube channels found by a country search that declare no country are kept as
-- candidates without a country, grouped by region (of the search) and language. creators.region holds that region
-- (a countries.region value, e.g. 'West Africa'); a creator with a country takes its region from the country.
-- Idempotent: migrate.js re-runs every file.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS idx_creators_region ON creators (region, review_status) WHERE country_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_creators_languages ON creators USING gin (languages);
