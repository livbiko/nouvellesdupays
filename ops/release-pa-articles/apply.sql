-- PA Media (publisher 6757, suspended in Build #55): its 218 stored articles link to pa.media/blogs/... URLs that now redirect
-- to PA's generic /news-showcase page, so they no longer reach the story. No admin endpoint hides articles; following the
-- release-queue-cleanup precedent the rows are saved to articles-6757.csv (in this folder) and deleted.
-- Nothing references articles (no FKs, no triggers, 0 analytics_events rows). MEDIUM per Get-ChangeRisk. Reverse: reverse.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 6757 AND name = 'PA Media (Press Association)' AND feed_status = 'suspended') THEN
    RAISE EXCEPTION 'publisher 6757 is not the suspended PA Media'; END IF;
  IF (select md5(string_agg(row_to_json(a)::text, '~' order by id)) from articles a where publisher_id = 6757) IS DISTINCT FROM 'bd4acf818ee7cefef9a13bfe70ee842c' THEN
    RAISE EXCEPTION 'PA Media articles differ from the 218 rows saved in articles-6757.csv'; END IF;
END $$;
DELETE FROM articles WHERE publisher_id = 6757;
select 'fp|' || count(*) || '|' || coalesce((select md5(string_agg(row_to_json(a)::text, '~' order by id)) from articles a where publisher_id = 6757), '-') from articles a where publisher_id = 6757;
COMMIT;
