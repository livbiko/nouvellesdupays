-- Reverse of apply.sql: mapped articles back to their old category (only where still at the new one).
-- Category backfill for the categorizer keyword exceptions (fix 6fdb75b). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's headline-only result and
-- whose NEW headline-only result differs (1496 rows, md5 20b09ca2ff8fdc7172c450e729fbc046 over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM category_map) <> 1496 THEN RAISE EXCEPTION 'category_map has % rows, expected 1496', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> '20b09ca2ff8fdc7172c450e729fbc046' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END $$;
UPDATE articles a SET category = m.old FROM category_map m WHERE a.id = m.id AND a.category = m.new;
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
COMMIT;
