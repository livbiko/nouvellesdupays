-- Category backfill for the publisher-language correction (lang.sql: 1054 en->ar, 1537 fr->en;
-- categorizer unchanged, Build #65). category-map.csv holds id,old,new for every article of those publishers whose stored
-- category equals the categorizer's result with the OLD language (headline, URL) and whose result with the NEW language
-- differs (53 rows, md5 92859a31f0c8ae9538481bcaf3e9aba2 over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
-- Batched: autocommit, 500 rows per committed statement (see Build-Sql.ps1). Never wrap in BEGIN.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM category_map) <> 53 THEN RAISE EXCEPTION 'category_map has % rows, expected 53', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> '92859a31f0c8ae9538481bcaf3e9aba2' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END $$;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
