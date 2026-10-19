\set ON_ERROR_STOP on
SET lock_timeout = '5s';
SET statement_timeout = '120s';
BEGIN;
-- Media organisations and their channels (2026-10-19, owner request: "Africa Media Discovery" spec, sections 9, 11, 12,
-- 15, 16, 20). A publisher already is the media organisation (feeds = its website channels); what was missing is a
-- record per official social/video account with verification and evidence, a place for publicly visible audience
-- numbers, a stable slug for /source/[slug] pages, and separate quality/activity/audience/reliability scores.
--
-- Additive only, idempotent (db/migrate.js re-runs every file). The existing publishers.*_url columns stay as they
-- are (the site and the discovery worker read them); social_accounts is backfilled from them and becomes the
-- per-channel record. audience_metrics starts empty: numbers only come from an official API or a reviewer, never
-- estimated (spec section 26).

-- 1. publishers: stable public slug + organisation/individual (same values as discovered_sources.creator_kind).
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS creator_kind TEXT NOT NULL DEFAULT 'organisation';
ALTER TABLE publishers DROP CONSTRAINT IF EXISTS publishers_creator_kind_check;
ALTER TABLE publishers ADD CONSTRAINT publishers_creator_kind_check CHECK (creator_kind IN ('organisation', 'individual'));

-- Slug backfill, only for rows without one (re-runs leave existing slugs alone). Accents removed by Unicode
-- decomposition (NFD, so Vietnamese "Tuổi Trẻ" -> tuoi-tre). Name first, domain when the name has
-- no Latin letters (Arabic, Chinese...), then -<iso> and finally -<id> to break collisions.
WITH base AS (
  SELECT p.id, lower(c.iso_code) AS iso,
         coalesce(nullif(trim(BOTH '-' FROM regexp_replace(lower(translate(regexp_replace(normalize(p.name, NFD), '[\u0300-\u036f]', '', 'g'),
           'ĐđØøŁłßÆæŒœıĦħ', 'DdOoLlsAaOoiHh')), '[^a-z0-9]+', '-', 'g')), ''),
                  trim(BOTH '-' FROM regexp_replace(lower(p.domain), '[^a-z0-9]+', '-', 'g'))) AS b
    FROM publishers p JOIN countries c ON c.id = p.country_id
   WHERE p.slug IS NULL),
taken AS (SELECT slug FROM publishers WHERE slug IS NOT NULL),
ranked AS (
  SELECT id, iso, b,
         count(*) OVER (PARTITION BY b) AS n_b,
         count(*) OVER (PARTITION BY b, iso) AS n_bi
    FROM base)
UPDATE publishers p
   SET slug = left(CASE
         WHEN r.n_b = 1 AND NOT EXISTS (SELECT 1 FROM taken t WHERE t.slug = r.b) THEN r.b
         WHEN r.n_bi = 1 AND NOT EXISTS (SELECT 1 FROM taken t WHERE t.slug = r.b || '-' || r.iso) THEN r.b || '-' || r.iso
         ELSE r.b || '-' || p.id END, 90)
  FROM ranked r
 WHERE p.id = r.id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_publishers_slug ON publishers (slug);

-- 2. social_accounts: one row per official account of an organisation (or of a discovery candidate before promotion).
CREATE TABLE IF NOT EXISTS social_accounts (
  id                    SERIAL PRIMARY KEY,
  publisher_id          INTEGER REFERENCES publishers(id),
  discovered_source_id  INTEGER REFERENCES discovered_sources(id),
  platform              TEXT NOT NULL CHECK (platform IN ('youtube', 'facebook', 'tiktok', 'x', 'instagram')),
  url                   TEXT NOT NULL,
  handle                TEXT,
  platform_account_id   TEXT,               -- e.g. YouTube UC... id, when known
  verification          TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (verification IN ('unverified', 'linked_from_site', 'verified', 'rejected')),
  verification_url      TEXT,               -- evidence: the page that shows the link (spec section 26)
  discovered_from       TEXT,               -- where the account was found
  status                TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'active', 'inactive', 'dead')),
  last_checked_at       TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (publisher_id IS NOT NULL OR discovered_source_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_url ON social_accounts (platform, lower(rtrim(url, '/')));
CREATE INDEX IF NOT EXISTS idx_social_accounts_publisher ON social_accounts (publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_discovered ON social_accounts (discovered_source_id) WHERE discovered_source_id IS NOT NULL;

-- Backfill from publishers.*_url. Their provenance is not recorded, so they start 'unverified'; ON CONFLICT keeps the
-- first publisher when several share an account (e.g. one channel for a group's titles) - the rest stay in the columns.
INSERT INTO social_accounts (publisher_id, platform, url, verification, discovered_from)
SELECT p.id, s.platform, trim(s.url), 'unverified', 'publishers.' || s.platform || '_url (backfill, migration 016)'
  FROM publishers p
  CROSS JOIN LATERAL (VALUES ('youtube', p.youtube_url), ('facebook', p.facebook_url), ('tiktok', p.tiktok_url),
                             ('x', p.x_url), ('instagram', p.instagram_url)) AS s(platform, url)
 WHERE s.url IS NOT NULL AND trim(s.url) ~* '^https?://'
 ORDER BY p.id
ON CONFLICT DO NOTHING;

-- 3. audience_metrics: append-only, publicly visible numbers only, each with where it came from.
CREATE TABLE IF NOT EXISTS audience_metrics (
  id                 BIGSERIAL PRIMARY KEY,
  social_account_id  INTEGER NOT NULL REFERENCES social_accounts(id),
  metric             TEXT NOT NULL CHECK (metric IN ('subscribers', 'followers', 'total_views', 'video_count', 'avg_recent_views', 'recent_uploads_30d')),
  value              BIGINT NOT NULL CHECK (value >= 0),
  source             TEXT NOT NULL CHECK (source IN ('youtube_data_api', 'reviewer')),
  evidence_url       TEXT,
  measured_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audience_metrics_latest ON audience_metrics (social_account_id, metric, measured_at DESC);

-- 4. source_scores: separate score kinds (spec section 9). Existing rows are the overall score.
ALTER TABLE source_scores ADD COLUMN IF NOT EXISTS score_kind TEXT NOT NULL DEFAULT 'overall';
ALTER TABLE source_scores DROP CONSTRAINT IF EXISTS source_scores_score_kind_check;
ALTER TABLE source_scores ADD CONSTRAINT source_scores_score_kind_check
  CHECK (score_kind IN ('overall', 'quality', 'activity', 'audience', 'reliability'));
CREATE INDEX IF NOT EXISTS idx_source_scores_kind ON source_scores (publisher_id, score_kind, computed_at DESC) WHERE publisher_id IS NOT NULL;

-- second run: must be a no-op (idempotent)
-- Media organisations and their channels (2026-10-19, owner request: "Africa Media Discovery" spec, sections 9, 11, 12,
-- 15, 16, 20). A publisher already is the media organisation (feeds = its website channels); what was missing is a
-- record per official social/video account with verification and evidence, a place for publicly visible audience
-- numbers, a stable slug for /source/[slug] pages, and separate quality/activity/audience/reliability scores.
--
-- Additive only, idempotent (db/migrate.js re-runs every file). The existing publishers.*_url columns stay as they
-- are (the site and the discovery worker read them); social_accounts is backfilled from them and becomes the
-- per-channel record. audience_metrics starts empty: numbers only come from an official API or a reviewer, never
-- estimated (spec section 26).

-- 1. publishers: stable public slug + organisation/individual (same values as discovered_sources.creator_kind).
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS creator_kind TEXT NOT NULL DEFAULT 'organisation';
ALTER TABLE publishers DROP CONSTRAINT IF EXISTS publishers_creator_kind_check;
ALTER TABLE publishers ADD CONSTRAINT publishers_creator_kind_check CHECK (creator_kind IN ('organisation', 'individual'));

-- Slug backfill, only for rows without one (re-runs leave existing slugs alone). Accents removed by Unicode
-- decomposition (NFD, so Vietnamese "Tuổi Trẻ" -> tuoi-tre). Name first, domain when the name has
-- no Latin letters (Arabic, Chinese...), then -<iso> and finally -<id> to break collisions.
WITH base AS (
  SELECT p.id, lower(c.iso_code) AS iso,
         coalesce(nullif(trim(BOTH '-' FROM regexp_replace(lower(translate(regexp_replace(normalize(p.name, NFD), '[\u0300-\u036f]', '', 'g'),
           'ĐđØøŁłßÆæŒœıĦħ', 'DdOoLlsAaOoiHh')), '[^a-z0-9]+', '-', 'g')), ''),
                  trim(BOTH '-' FROM regexp_replace(lower(p.domain), '[^a-z0-9]+', '-', 'g'))) AS b
    FROM publishers p JOIN countries c ON c.id = p.country_id
   WHERE p.slug IS NULL),
taken AS (SELECT slug FROM publishers WHERE slug IS NOT NULL),
ranked AS (
  SELECT id, iso, b,
         count(*) OVER (PARTITION BY b) AS n_b,
         count(*) OVER (PARTITION BY b, iso) AS n_bi
    FROM base)
UPDATE publishers p
   SET slug = left(CASE
         WHEN r.n_b = 1 AND NOT EXISTS (SELECT 1 FROM taken t WHERE t.slug = r.b) THEN r.b
         WHEN r.n_bi = 1 AND NOT EXISTS (SELECT 1 FROM taken t WHERE t.slug = r.b || '-' || r.iso) THEN r.b || '-' || r.iso
         ELSE r.b || '-' || p.id END, 90)
  FROM ranked r
 WHERE p.id = r.id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_publishers_slug ON publishers (slug);

-- 2. social_accounts: one row per official account of an organisation (or of a discovery candidate before promotion).
CREATE TABLE IF NOT EXISTS social_accounts (
  id                    SERIAL PRIMARY KEY,
  publisher_id          INTEGER REFERENCES publishers(id),
  discovered_source_id  INTEGER REFERENCES discovered_sources(id),
  platform              TEXT NOT NULL CHECK (platform IN ('youtube', 'facebook', 'tiktok', 'x', 'instagram')),
  url                   TEXT NOT NULL,
  handle                TEXT,
  platform_account_id   TEXT,               -- e.g. YouTube UC... id, when known
  verification          TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (verification IN ('unverified', 'linked_from_site', 'verified', 'rejected')),
  verification_url      TEXT,               -- evidence: the page that shows the link (spec section 26)
  discovered_from       TEXT,               -- where the account was found
  status                TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'active', 'inactive', 'dead')),
  last_checked_at       TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (publisher_id IS NOT NULL OR discovered_source_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_url ON social_accounts (platform, lower(rtrim(url, '/')));
CREATE INDEX IF NOT EXISTS idx_social_accounts_publisher ON social_accounts (publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_discovered ON social_accounts (discovered_source_id) WHERE discovered_source_id IS NOT NULL;

-- Backfill from publishers.*_url. Their provenance is not recorded, so they start 'unverified'; ON CONFLICT keeps the
-- first publisher when several share an account (e.g. one channel for a group's titles) - the rest stay in the columns.
INSERT INTO social_accounts (publisher_id, platform, url, verification, discovered_from)
SELECT p.id, s.platform, trim(s.url), 'unverified', 'publishers.' || s.platform || '_url (backfill, migration 016)'
  FROM publishers p
  CROSS JOIN LATERAL (VALUES ('youtube', p.youtube_url), ('facebook', p.facebook_url), ('tiktok', p.tiktok_url),
                             ('x', p.x_url), ('instagram', p.instagram_url)) AS s(platform, url)
 WHERE s.url IS NOT NULL AND trim(s.url) ~* '^https?://'
 ORDER BY p.id
ON CONFLICT DO NOTHING;

-- 3. audience_metrics: append-only, publicly visible numbers only, each with where it came from.
CREATE TABLE IF NOT EXISTS audience_metrics (
  id                 BIGSERIAL PRIMARY KEY,
  social_account_id  INTEGER NOT NULL REFERENCES social_accounts(id),
  metric             TEXT NOT NULL CHECK (metric IN ('subscribers', 'followers', 'total_views', 'video_count', 'avg_recent_views', 'recent_uploads_30d')),
  value              BIGINT NOT NULL CHECK (value >= 0),
  source             TEXT NOT NULL CHECK (source IN ('youtube_data_api', 'reviewer')),
  evidence_url       TEXT,
  measured_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audience_metrics_latest ON audience_metrics (social_account_id, metric, measured_at DESC);

-- 4. source_scores: separate score kinds (spec section 9). Existing rows are the overall score.
ALTER TABLE source_scores ADD COLUMN IF NOT EXISTS score_kind TEXT NOT NULL DEFAULT 'overall';
ALTER TABLE source_scores DROP CONSTRAINT IF EXISTS source_scores_score_kind_check;
ALTER TABLE source_scores ADD CONSTRAINT source_scores_score_kind_check
  CHECK (score_kind IN ('overall', 'quality', 'activity', 'audience', 'reliability'));
CREATE INDEX IF NOT EXISTS idx_source_scores_kind ON source_scores (publisher_id, score_kind, computed_at DESC) WHERE publisher_id IS NOT NULL;

SELECT 'slugs|' || count(*) || ' publishers|' || count(slug) || ' with slug|' || count(DISTINCT slug) || ' distinct|' || count(*) FILTER (WHERE slug ~ '-[0-9]+$') || ' id-suffixed' FROM publishers;
SELECT 'slug_sample|' || string_agg(name || ' -> ' || slug, ' ; ') FROM (SELECT name, slug FROM publishers WHERE id IN (1, 6, 1050, 8979, 9033, 2069, 987, 9042) ORDER BY id) x;
SELECT 'nonlatin_sample|' || string_agg(name || ' -> ' || slug, ' ; ') FROM (SELECT name, slug FROM publishers WHERE name !~ '[A-Za-z]' ORDER BY id LIMIT 4) x;
SELECT 'social|' || platform || '|' || count(*) FROM social_accounts GROUP BY platform ORDER BY 1;
SELECT 'scores|' || score_kind || '|' || count(*) FROM source_scores GROUP BY score_kind;
SELECT 'metrics|' || count(*) FROM audience_metrics;
ROLLBACK;
SELECT 'rolledback|' || coalesce(to_regclass('social_accounts')::text, 'no social_accounts') || '|' ||
       (SELECT count(*) FROM information_schema.columns WHERE table_name = 'publishers' AND column_name = 'slug') || ' slug column';
