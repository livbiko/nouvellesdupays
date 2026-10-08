-- Côte d'Ivoire Voices, row 500: "PPA-CI Officiel" (UC3d16l9...) has not posted for ~1 year.
-- Owner decision 2026-10-08 (option a): switch to the active "PPA CI TV" channel
-- (179K subs, daily uploads), labelled as a supporters' channel because its
-- official status could not be verified (party site ppaci.ci returns 404).
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM video_channels WHERE id = 500 AND youtube_channel_id = 'UC3d16l9ZQtT69gB4C2UOahQ' AND category = 'local_voices') THEN
    RAISE EXCEPTION 'row 500 is not in the expected state'; END IF;
END $$;
UPDATE video_channels
   SET name = 'PPA-CI TV (chaîne de soutien)',
       youtube_channel_id = 'UC9FkJGcJeo8kgZRPq80qw5w',
       channel_url = 'https://www.youtube.com/channel/UC9FkJGcJeo8kgZRPq80qw5w',
       logo_url = NULL, updated_at = now()
 WHERE id = 500 AND youtube_channel_id = 'UC3d16l9ZQtT69gB4C2UOahQ';
SELECT id, name, youtube_channel_id FROM video_channels WHERE id = 500;
COMMIT;
