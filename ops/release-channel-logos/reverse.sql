-- CR-2026-11-17-04 rollback (data). Before the first run no video_channels row had a logo (before.txt: 537 rows, 0
-- logos), so every logo on a YouTube image host was set by refreshChannelLogos. Metrics rows it wrote are
-- audience_metrics source 'youtube_data_api' at the run's measured_at for the linked accounts; they are additive and
-- are left unless the owner asks (delete by measured_at of the run in agent_runs, message LIKE 'channel-logos%').
-- Code: set the worker back to rollback-d2a8c8ec (CronJobs pull :local with Always).
BEGIN;
UPDATE video_channels SET logo_url = NULL
 WHERE logo_url ~ '^https://yt3\.(ggpht|googleusercontent)\.com/';
SELECT count(*) AS logos_left FROM video_channels WHERE logo_url IS NOT NULL;
COMMIT;
