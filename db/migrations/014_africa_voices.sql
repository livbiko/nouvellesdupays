-- "Africa Voices": genuinely pan-African channels are stored ONCE, with no
-- country, instead of being copied into every African country's
-- local_voices list (they had been duplicated into all 54 -- 7 channels x 54
-- rows). Country sections ("Côte d'Ivoire Voices", ...) keep only that
-- country's own channels; the API returns africa_voices alongside them for
-- African countries. Idempotent: migrate.js re-applies every file each run.

ALTER TABLE video_channels DROP CONSTRAINT IF EXISTS video_channels_category_check;
ALTER TABLE video_channels ADD CONSTRAINT video_channels_category_check
  CHECK (category IN ('live_now', 'local_voices', 'national_tv', 'africa_voices'));

ALTER TABLE video_channels ALTER COLUMN country_id DROP NOT NULL;

-- Only continent-wide rows may omit the country.
ALTER TABLE video_channels DROP CONSTRAINT IF EXISTS video_channels_country_scope_check;
ALTER TABLE video_channels ADD CONSTRAINT video_channels_country_scope_check
  CHECK (category = 'africa_voices' OR country_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_channels_africa_voices_channel
  ON video_channels (youtube_channel_id) WHERE category = 'africa_voices';
