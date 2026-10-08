-- Taken right before the delete; rollback_video_channels.sql restores from it.
\set ON_ERROR_STOP on
\copy (SELECT * FROM video_channels ORDER BY id) TO '/tmp/ndp-backup/video_channels_pre_playlist.csv' WITH (FORMAT csv, HEADER true)
SELECT count(*) AS video_channels_rows FROM video_channels;
