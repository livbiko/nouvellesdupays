-- Category backfill for French-only whole-word "foot" (fix a443e99). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's headline-only result and
-- whose NEW headline-only result (with the publisher language) differs (233 rows, md5 44857b9ed5343e6c8a4280970fb25f6e over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM category_map) <> 233 THEN RAISE EXCEPTION 'category_map has % rows, expected 233', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> '44857b9ed5343e6c8a4280970fb25f6e' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END $$;
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM category_map m LEFT JOIN articles a ON a.id = m.id WHERE a.id IS NOT NULL AND a.category NOT IN (m.old, m.new)) THEN
    RAISE EXCEPTION 'some mapped articles have a third category value (changed since the mapping was made)'; END IF;
END $$;
UPDATE articles a SET category = m.new FROM category_map m WHERE a.id = m.id AND a.category = m.old;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
UPDATE articles a SET category = m.old FROM category_map m WHERE a.id = m.id AND a.category = m.new;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
ROLLBACK;
