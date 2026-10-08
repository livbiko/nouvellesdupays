-- Exact reverse of fix_ppaci.sql.
\set ON_ERROR_STOP on
BEGIN;
UPDATE video_channels
   SET name = 'PPA-CI Officiel', youtube_channel_id = 'UC3d16l9ZQtT69gB4C2UOahQ',
       channel_url = 'https://www.youtube.com/@PPACIOfficiel', updated_at = now()
 WHERE id = 500 AND youtube_channel_id = 'UC9FkJGcJeo8kgZRPq80qw5w';
SELECT id, name, youtube_channel_id FROM video_channels WHERE id = 500;
COMMIT;
