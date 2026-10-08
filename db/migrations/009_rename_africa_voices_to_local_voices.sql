-- Renames the 'africa_voices' category to 'local_voices'. That name only
-- ever made sense while the category held Africa-only content; the Voices
-- rollout now populates it for every country (Côte d'Ivoire, Germany,
-- France, etc.), each displayed as "{Country} Voices" in the UI -- keeping
-- the DB/API field literally named "africa_voices" once it holds German
-- and French rows too would be actively misleading to anyone reading the
-- schema or API response later.
-- Idempotent: safe to re-run (drop-if-exists + re-add the constraint every
-- time, matching this project's no-migration-tracking-table convention).

ALTER TABLE video_channels DROP CONSTRAINT IF EXISTS video_channels_category_check;

-- 2026-10-08: migration 014 reintroduced 'africa_voices' with a NEW meaning
-- (pan-African channels stored once, country_id NULL). migrate.js re-applies
-- every file on each run, so this one-time rename must only touch legacy
-- per-country rows, and the constraint must keep allowing the 014 value --
-- otherwise every deploy after 014 would convert/reject those rows and fail.
UPDATE video_channels SET category = 'local_voices' WHERE category = 'africa_voices' AND country_id IS NOT NULL;

ALTER TABLE video_channels ADD CONSTRAINT video_channels_category_check
  CHECK (category IN ('live_now', 'local_voices', 'national_tv', 'africa_voices'));
