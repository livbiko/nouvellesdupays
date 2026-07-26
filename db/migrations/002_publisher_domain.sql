-- Phase 2 Stage 3: formalize publisher dedup beyond exact-name matching.
-- Domain is a more meaningful duplicate signal than name (e.g. "BBC News" vs
-- "BBC" would slip past a name-only check, but share bbc.co.uk). Scoped to
-- (country_id, domain), not a global unique domain, because a single
-- international brand can legitimately have distinct per-country editions
-- with different feeds (e.g. theguardian.com serves both the UK and
-- Australia entries in this dataset) -- collapsing those into one row would
-- require a Publisher<->Country many-to-many redesign this project doesn't
-- need yet, and would be wrong for how this platform actually models feeds.

ALTER TABLE publishers ADD COLUMN IF NOT EXISTS domain TEXT;

-- Backfill existing rows: strip protocol and "www." prefix from homepage_url.
UPDATE publishers
SET domain = regexp_replace(regexp_replace(homepage_url, '^https?://', ''), '^www\.', '')
WHERE domain IS NULL;

ALTER TABLE publishers ALTER COLUMN domain SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_publishers_country_domain ON publishers (country_id, domain);
