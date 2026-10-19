\set ON_ERROR_STOP on
SELECT 'slugs|' || count(*) || ' publishers|' || count(slug) || ' with slug|' || count(DISTINCT slug) || ' distinct' FROM publishers;
SELECT 'social|' || platform || '|' || count(*) FROM social_accounts GROUP BY platform ORDER BY 1;
SELECT 'scores|' || score_kind || '|' || count(*) FROM source_scores GROUP BY score_kind;
SELECT 'active|' || count(*) FROM publishers WHERE feed_status = 'active';
