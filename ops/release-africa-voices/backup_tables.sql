-- Step 3b: table backups for the targeted rollback (rollback_data.sql reads these).
\set ON_ERROR_STOP on
\copy (SELECT * FROM video_channels ORDER BY id) TO '/tmp/ndp-backup/video_channels.csv' WITH (FORMAT csv, HEADER true)
\copy (SELECT id, source_type, feed_status, homepage_url, facebook_url, instagram_url, tiktok_url, x_url, youtube_url FROM publishers ORDER BY id) TO '/tmp/ndp-backup/publishers_cols.csv' WITH (FORMAT csv, HEADER true)
SELECT (SELECT count(*) FROM video_channels) AS video_channels_rows, (SELECT count(*) FROM publishers) AS publishers_rows;
