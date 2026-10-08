\set ON_ERROR_STOP on
\copy (SELECT * FROM video_channels ORDER BY id) TO '/tmp/ndp-backup/video_channels_pre_national_tv.csv' WITH (FORMAT csv, HEADER true)
SELECT count(*) AS video_channels_rows FROM video_channels;
