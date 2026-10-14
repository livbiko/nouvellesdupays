-- Reverse of apply.sql: mapped articles back to their old category (only where still at the new one).
-- Category backfill for the URL section fallback + "mercato de la mode" exclusion (fix 649845c). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's headline-only result and
-- whose NEW headline-only result (with the publisher language) differs (316468 rows, md5 fd465cf5668dd1636c1b81c2c9810dfd over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
-- Batched: autocommit, 500 rows per committed statement (see Build-Sql.ps1). Never wrap in BEGIN.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO $$
BEGIN
  IF (SELECT count(*) FROM category_map) <> 316468 THEN RAISE EXCEPTION 'category_map has % rows, expected 316468', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> 'fd465cf5668dd1636c1b81c2c9810dfd' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END $$;
CREATE TEMP TABLE batch_map AS SELECT m.id, m.old, m.new, ((row_number() OVER (ORDER BY m.id)) - 1) / 500 AS b FROM category_map m JOIN articles a ON a.id = m.id AND a.category = m.new;
CREATE INDEX ON batch_map (b); ANALYZE batch_map;
select 'start|' || clock_timestamp();
SET statement_timeout = '15s';
SET log_min_duration_statement = 3000;
SELECT 'DO $w$ BEGIN IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = ''Lock'' AND now() - query_start > interval ''30 seconds'') THEN RAISE EXCEPTION ''stopping: a session has waited on a lock for over 30s''; END IF; END $w$',
       format('UPDATE articles a SET category = m.old FROM batch_map m WHERE m.b = %s AND a.id = m.id AND a.category = m.new', b),
       'SELECT pg_sleep(4)'
  FROM generate_series(0, coalesce((SELECT max(b) FROM batch_map), -1)) b ORDER BY b
\gexec
RESET statement_timeout;
RESET log_min_duration_statement;
select 'end|' || clock_timestamp();
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
