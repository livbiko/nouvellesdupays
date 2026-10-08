-- Restores video_channels exactly as backed up in step 3 (backup_video_channels.sql).
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM video_channels;
\copy video_channels FROM '/tmp/ndp-backup/video_channels_pre_playlist.csv' WITH (FORMAT csv, HEADER true)
SELECT setval(pg_get_serial_sequence('video_channels', 'id'), (SELECT max(id) FROM video_channels));
SELECT count(*) AS video_channels_restored FROM video_channels;
COMMIT;
