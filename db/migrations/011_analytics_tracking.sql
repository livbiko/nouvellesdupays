-- First-party analytics, attribution and conversion tracking (Meta/Facebook
-- ad measurement). Before this migration the project had NO analytics of any
-- kind -- no GA4, no GTM, no Meta Pixel, no event table -- so this is a new
-- subsystem rather than an extension of an existing one.
--
-- Privacy model (see docs/ANALYTICS-TRACKING.md):
--   * visitor_id / session_id are random UUIDs generated in the browser
--     only AFTER analytics consent -- never derived from IP, email or device
--     fingerprint.
--   * No IP address and no raw User-Agent is persisted. The IP/UA are only
--     held in memory long enough to forward a consented event to Meta's
--     Conversions API.
--   * Personal data (email) lives only in `leads` / `contact_messages`,
--     never in the event stream.
--
-- Idempotent like every migration here (db/migrate.js re-runs every file on
-- each deploy, there is no migration-tracking table).

CREATE TABLE IF NOT EXISTS analytics_visitors (
  id                    UUID PRIMARY KEY,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- First-touch attribution, written once on insert and never overwritten.
  first_utm_source      TEXT,
  first_utm_medium      TEXT,
  first_utm_campaign    TEXT,
  first_utm_content     TEXT,
  first_utm_term        TEXT,
  first_fbclid          TEXT,
  first_landing_page    TEXT,
  first_referrer        TEXT,
  first_channel         TEXT
);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_first_seen ON analytics_visitors (first_seen_at);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id                UUID PRIMARY KEY,
  visitor_id        UUID NOT NULL REFERENCES analytics_visitors(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  landing_page      TEXT,
  referrer          TEXT,           -- referring origin + path only, never a query string
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_content       TEXT,
  utm_term          TEXT,
  fbclid            TEXT,
  channel           TEXT NOT NULL DEFAULT 'direct' CHECK (channel IN (
                      'paid_social', 'organic_social', 'paid_search', 'organic_search',
                      'email', 'referral', 'direct', 'other')),
  is_facebook       BOOLEAN NOT NULL DEFAULT false,
  is_paid           BOOLEAN NOT NULL DEFAULT false,
  device_class      TEXT CHECK (device_class IN ('mobile', 'tablet', 'desktop')),
  page_views        INTEGER NOT NULL DEFAULT 0,
  event_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_campaign ON analytics_sessions (utm_campaign, started_at);

-- One row per tracked event. Session attribution (utm_*, channel,
-- landing_page) is denormalised onto every row so dashboard filters and
-- group-bys never need to join back to analytics_sessions -- the event
-- table is the only hot table at query time.
CREATE TABLE IF NOT EXISTS analytics_events (
  id              BIGSERIAL PRIMARY KEY,
  event_id        UUID NOT NULL UNIQUE,      -- client-generated; also the Meta Pixel/CAPI deduplication key
  event_name      TEXT NOT NULL,
  event_category  TEXT NOT NULL CHECK (event_category IN ('page', 'engagement', 'conversion')),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  visitor_id      UUID NOT NULL,
  session_id      UUID NOT NULL,
  page_path       TEXT,
  page_type       TEXT,
  country_iso     CHAR(2),
  publisher_id    INTEGER,
  video_id        INTEGER,                   -- youtube_videos.id (no FK: events must never block a video delete)
  article_id      INTEGER,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  channel         TEXT,
  is_facebook     BOOLEAN NOT NULL DEFAULT false,
  is_paid         BOOLEAN NOT NULL DEFAULT false,
  landing_page    TEXT,
  properties      JSONB NOT NULL DEFAULT '{}',
  is_debug        BOOLEAN NOT NULL DEFAULT false,
  source          TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server')),
  meta_status     TEXT NOT NULL DEFAULT 'not_applicable' CHECK (meta_status IN (
                    'not_applicable', 'no_consent', 'disabled', 'queued', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred ON analytics_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_occurred ON analytics_events (event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_campaign ON analytics_events (utm_campaign, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_source ON analytics_events (utm_source, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country ON analytics_events (country_iso, occurred_at) WHERE country_iso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_publisher ON analytics_events (publisher_id, occurred_at) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_video ON analytics_events (video_id, occurred_at) WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_landing ON analytics_events (landing_page, occurred_at);

-- Campaign registry + manually-entered spend. Meta's ad spend is not pulled
-- automatically (that would need the Marketing API + an ads_read token);
-- an admin enters daily spend (and, optionally, Meta-reported impressions
-- and link clicks) so cost-per-lead and the "Facebook Ad" funnel stage are
-- computed from real numbers instead of being guessed.
CREATE TABLE IF NOT EXISTS campaigns (
  id            SERIAL PRIMARY KEY,
  utm_campaign  TEXT NOT NULL UNIQUE,
  label         TEXT,
  platform      TEXT NOT NULL DEFAULT 'meta' CHECK (platform IN ('meta', 'google', 'tiktok', 'other')),
  objective     TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_spend (
  id            SERIAL PRIMARY KEY,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  utm_content   TEXT NOT NULL DEFAULT '',   -- '' = whole campaign; otherwise one ad
  spend_date    DATE NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency      CHAR(3) NOT NULL DEFAULT 'EUR',
  impressions   INTEGER CHECK (impressions >= 0),
  link_clicks   INTEGER CHECK (link_clicks >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, utm_content, spend_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_spend_date ON campaign_spend (spend_date);

-- Visitor registration ("Rejoindre NouvellesDuPays") -- the site had no
-- user-account system before this, so a lead is a consented sign-up
-- (email + optional name/country/interests), not a password account.
CREATE TABLE IF NOT EXISTS leads (
  id                   SERIAL PRIMARY KEY,
  email                TEXT NOT NULL,
  email_hash           TEXT NOT NULL UNIQUE,   -- sha256(lower(trim(email))): dedup key, never exposed
  name                 TEXT,
  country_id           INTEGER REFERENCES countries(id),
  interests            TEXT[] NOT NULL DEFAULT '{}',
  marketing_consent    BOOLEAN NOT NULL DEFAULT false,
  privacy_accepted_at  TIMESTAMPTZ NOT NULL,
  source_page          TEXT,
  video_id             INTEGER,
  visitor_id           UUID,
  session_id           UUID,
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,
  utm_content          TEXT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'deleted')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads (utm_campaign, created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  visitor_id  UUID,
  session_id  UUID,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages (created_at);

-- Admin-editable runtime settings (tracking on/off, consent mode, Meta
-- Pixel ID, debug mode, crawler defaults, landing-page copy). Secrets
-- (META_ACCESS_TOKEN, ...) are NEVER stored here -- env only.
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
