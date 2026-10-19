-- Reverse of migration 016 (only if the release must be undone). Run with the tunnel up: .\Sql.ps1 reverse.sql
-- Then revert the migration commit on main BEFORE the next api build: db/migrate.js re-runs every file and would recreate it.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DROP TABLE IF EXISTS audience_metrics;
DROP TABLE IF EXISTS social_accounts;
DROP INDEX IF EXISTS idx_source_scores_kind;
ALTER TABLE source_scores DROP CONSTRAINT IF EXISTS source_scores_score_kind_check;
ALTER TABLE source_scores DROP COLUMN IF EXISTS score_kind;
DROP INDEX IF EXISTS idx_publishers_slug;
ALTER TABLE publishers DROP CONSTRAINT IF EXISTS publishers_creator_kind_check;
ALTER TABLE publishers DROP COLUMN IF EXISTS creator_kind;
ALTER TABLE publishers DROP COLUMN IF EXISTS slug;
COMMIT;
SELECT 'reversed|' || coalesce(to_regclass('social_accounts')::text, 'no social_accounts') || '|' ||
       (SELECT count(*) FROM information_schema.columns WHERE table_name = 'publishers' AND column_name IN ('slug', 'creator_kind')) || ' publisher columns left';
