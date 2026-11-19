-- CR-2026-11-18-08: the latest uploads of the /youtube directory channels, read once a day from the official YouTube
-- Data API (worker channel-logos.js, playlistItems on each channel's uploads playlist). Only ids, titles, dates and
-- thumbnail links are kept, and nothing older than 30 days (the worker deletes the rest). New table only; re-runs are
-- no-ops.
CREATE TABLE IF NOT EXISTS channel_videos (
  youtube_video_id text PRIMARY KEY,
  channel_key      text NOT NULL,          -- the channel's YouTube id, like video_channels.youtube_channel_id
  title            text NOT NULL,
  published_at     timestamptz NOT NULL,
  thumbnail_url    text,
  fetched_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_videos_published_idx ON channel_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS channel_videos_channel_idx ON channel_videos (channel_key);
