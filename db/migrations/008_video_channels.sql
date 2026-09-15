-- Phase 1 of the "Live Now / Africa Voices / National TV" video rail: a new
-- content type distinct from publishers/articles -- a channel, not a news
-- site with a feed. One table covers all three tabs (they differ only in
-- `category` and which optional fields matter) rather than three near-
-- identical tables. `always_show_in_world` is how a handful of major global
-- broadcasters (BBC, France 24, Al Jazeera...) surface in every country's
-- Live Now tab without a special-cased "World" pseudo-country -- their
-- country_id is their real country of origin (GB, FR, QA...).
CREATE TABLE video_channels (
  id                    SERIAL PRIMARY KEY,
  country_id            INTEGER NOT NULL REFERENCES countries(id),
  category              TEXT NOT NULL CHECK (category IN ('live_now', 'africa_voices', 'national_tv')),
  name                  TEXT NOT NULL,
  description           TEXT,             -- short subtitle, e.g. "Général / National", "Actualités"
  topic                 TEXT,             -- filter facet: news, politics, business, investigative, sports, culture, conflict, weather, technology
  platform              TEXT NOT NULL DEFAULT 'youtube'
                        CHECK (platform IN ('youtube', 'terrestrial', 'satellite', 'cable', 'iptv', 'streaming')),
  youtube_channel_id    TEXT,             -- powers the "latest video" lookup via YouTube's public per-channel Atom feed (no API key)
  channel_url           TEXT NOT NULL,
  logo_url              TEXT,
  always_show_in_world  BOOLEAN NOT NULL DEFAULT false,
  rank                  SMALLINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_channels_country_category ON video_channels (country_id, category, rank);
CREATE INDEX idx_video_channels_world ON video_channels (category) WHERE always_show_in_world;
