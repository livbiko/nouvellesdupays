-- YouTube channel/video registration + auto-generated landing pages.
--
-- Deliberately separate from the existing `video_channels` table: that table
-- is the hand-curated Live Now / Voices / National TV rail (category-driven,
-- country-scoped, always shown). These tables hold *submitted* content that
-- goes through moderation, and an approved video gets its own landing page
-- at /youtube/<slug> (used as the destination of paid Meta campaigns).
--
-- Only metadata that YouTube itself cannot provide is kept from the
-- submitter: title/thumbnail/channel come from YouTube (oEmbed, or the Data
-- API when YOUTUBE_API_KEY is configured) whenever available, and
-- metadata_source records where each video's metadata came from.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS youtube_channels (
  id                  SERIAL PRIMARY KEY,
  youtube_channel_id  TEXT UNIQUE,            -- UC... id when known
  handle              TEXT,                   -- @handle when known
  channel_url         TEXT NOT NULL UNIQUE,   -- normalised https://www.youtube.com/... URL
  name                TEXT,
  description         TEXT,
  country_id          INTEGER REFERENCES countries(id),
  language            TEXT,
  category            TEXT,
  contact_email       TEXT,                   -- private, admin-only
  publisher_id        INTEGER REFERENCES publishers(id),
  verification        TEXT NOT NULL DEFAULT 'unverified' CHECK (verification IN ('verified', 'unverified', 'invalid')),
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending', 'approved', 'rejected', 'suspended')),
  reviewer_note       TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_status ON youtube_channels (status, submitted_at);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id                    SERIAL PRIMARY KEY,
  youtube_video_id      CHAR(11) NOT NULL UNIQUE,
  slug                  TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title                 TEXT NOT NULL,
  description           TEXT,
  thumbnail_url         TEXT,
  channel_id            INTEGER REFERENCES youtube_channels(id),
  channel_name          TEXT,
  channel_url           TEXT,
  country_id            INTEGER REFERENCES countries(id),
  language              TEXT,
  category              TEXT,
  published_at          TIMESTAMPTZ,
  publisher_id          INTEGER REFERENCES publishers(id),
  contact_email         TEXT,                 -- private, admin-only, never returned by public endpoints
  metadata_source       TEXT NOT NULL DEFAULT 'submitter' CHECK (metadata_source IN ('youtube_api', 'oembed', 'submitter')),
  metadata_checked_at   TIMESTAMPTZ,
  availability          TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('available', 'unavailable', 'unknown')),
  status                TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending', 'approved', 'rejected', 'suspended')),
  reviewer_note         TEXT,
  -- Landing-page overrides (optional; defaults come from the video itself).
  landing_headline      TEXT,
  landing_cta_text      TEXT,
  is_featured           BOOLEAN NOT NULL DEFAULT false,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON youtube_videos (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_country ON youtube_videos (country_id, status, approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos (channel_id);
