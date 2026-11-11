-- Reverses Build #214 (migration 018): removes the creator tables and puts social_accounts / audience_metrics back to
-- their 016 constraints. Refuses if any creator data exists (creator rows, creator-owned accounts, or metrics of the new
-- kinds/sources) - by then a reverse would delete real data, so look first and decide by hand.
-- db/migrations/018_creators.sql must also be removed from the repo, or the next migrate.js run re-creates it all.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
SET statement_timeout = '120s';
BEGIN;
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM creators)
     OR EXISTS (SELECT 1 FROM social_accounts WHERE creator_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM audience_metrics WHERE window_days IS NOT NULL
                  OR metric IN ('page_likes', 'total_likes', 'recent_views', 'engagement_rate_bp', 'recent_posts')
                  OR source IN ('meta_graph_api', 'tiktok_api', 'creator_connected')) THEN
    RAISE EXCEPTION 'creator data exists - reverse would delete it; nothing changed';
  END IF;
END $do$;
DROP TABLE creator_rankings, creator_ranking_weights, agent_runs, discovery_jobs, discovery_agents,
           creator_verifications, creator_category_links;
ALTER TABLE social_accounts DROP CONSTRAINT social_accounts_owner_check;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_check CHECK (publisher_id IS NOT NULL OR discovered_source_id IS NOT NULL);
DROP INDEX IF EXISTS idx_social_accounts_creator;
ALTER TABLE social_accounts DROP COLUMN creator_id, DROP COLUMN display_name, DROP COLUMN profile_image_url, DROP COLUMN platform_verified;
DROP TABLE creators, creator_categories;
ALTER TABLE audience_metrics DROP CONSTRAINT audience_metrics_metric_check;
ALTER TABLE audience_metrics ADD CONSTRAINT audience_metrics_metric_check CHECK (metric IN (
  'subscribers', 'followers', 'total_views', 'video_count', 'avg_recent_views', 'recent_uploads_30d'));
ALTER TABLE audience_metrics DROP CONSTRAINT audience_metrics_source_check;
ALTER TABLE audience_metrics ADD CONSTRAINT audience_metrics_source_check CHECK (source IN ('youtube_data_api', 'reviewer'));
ALTER TABLE audience_metrics DROP COLUMN window_days;
\echo ===AFTER===
SELECT to_regclass('creators') creators, to_regclass('discovery_jobs') discovery_jobs,
       (SELECT count(*) FROM information_schema.columns WHERE table_name = 'social_accounts' AND column_name = 'creator_id') creator_col,
       (SELECT count(*) FROM social_accounts) social_accounts, (SELECT count(*) FROM audience_metrics) audience_metrics;
COMMIT;
