-- Reverse of apply.sql: reloads the 218 PA Media articles. Copy articles-6757.csv to postgres-0:/tmp/ first.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM articles WHERE publisher_id = 6757) THEN
    RAISE EXCEPTION 'publisher 6757 already has articles: not restoring over them'; END IF;
END $$;
\copy articles FROM '/tmp/articles-6757.csv' WITH CSV HEADER
select 'restored|' || count(*) || '|' || (select md5(string_agg(row_to_json(a)::text, '~' order by id)) from articles a where publisher_id = 6757) from articles a where publisher_id = 6757;
COMMIT;
