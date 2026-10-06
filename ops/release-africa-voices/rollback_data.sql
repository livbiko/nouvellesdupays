-- Restores video_channels and the publisher columns touched by
-- apply_data_cleanup.sql from the CSV backups taken in Step 3b.
-- (The two deleted QA test publishers are intentionally NOT restored.)
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM video_channels;
\copy video_channels FROM '/tmp/ndp-backup/video_channels.csv' WITH (FORMAT csv, HEADER true)
SELECT setval(pg_get_serial_sequence('video_channels', 'id'), (SELECT max(id) FROM video_channels));
CREATE TEMP TABLE pub_bak (id int PRIMARY KEY, source_type text, feed_status text, homepage_url text,
  facebook_url text, instagram_url text, tiktok_url text, x_url text, youtube_url text);
\copy pub_bak FROM '/tmp/ndp-backup/publishers_cols.csv' WITH (FORMAT csv, HEADER true)
UPDATE publishers p SET source_type = b.source_type, feed_status = b.feed_status, homepage_url = b.homepage_url,
  facebook_url = b.facebook_url, instagram_url = b.instagram_url, tiktok_url = b.tiktok_url,
  x_url = b.x_url, youtube_url = b.youtube_url
FROM pub_bak b WHERE p.id = b.id;
SELECT (SELECT count(*) FROM video_channels) AS video_channels_restored, (SELECT count(*) FROM pub_bak) AS publishers_restored;
COMMIT;
