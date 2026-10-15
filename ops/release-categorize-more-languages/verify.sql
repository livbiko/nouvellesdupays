-- Category backfill for last-pass keywords in ru, el, vi, hu, pl, cs, is, lt, bg, sl (fix 9888a93 + f75b7c3). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's result (headline, publisher
-- language, URL) and whose NEW result differs (28955 rows, md5 94911efd8c5a8711fc7987421ecd639d over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
-- Batched: autocommit, 500 rows per committed statement (see Build-Sql.ps1). Never wrap in BEGIN.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM category_map) <> 28955 THEN RAISE EXCEPTION 'category_map has % rows, expected 28955', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> '94911efd8c5a8711fc7987421ecd639d' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END $$;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
