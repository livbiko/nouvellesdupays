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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM category_map m JOIN articles a ON a.id = m.id WHERE a.category NOT IN (m.old, m.new)) THEN
    RAISE EXCEPTION 'some mapped articles have a third category value (changed since the mapping was made)'; END IF;
END $$;
CREATE TEMP TABLE batch_map AS SELECT m.id, m.old, m.new, ((row_number() OVER (ORDER BY m.id)) - 1) / 500 AS b FROM category_map m JOIN articles a ON a.id = m.id AND a.category = m.old;
CREATE INDEX ON batch_map (b); ANALYZE batch_map;
select 'start|' || clock_timestamp();
SET statement_timeout = '15s';
SET log_min_duration_statement = 3000;
SELECT 'DO $w$ BEGIN IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = ''Lock'' AND now() - query_start > interval ''30 seconds'') THEN RAISE EXCEPTION ''stopping: a session has waited on a lock for over 30s''; END IF; END $w$',
       format('UPDATE articles a SET category = m.new FROM batch_map m WHERE m.b = %s AND a.id = m.id AND a.category = m.old', b),
       'SELECT pg_sleep(4)'
  FROM generate_series(0, coalesce((SELECT max(b) FROM batch_map), -1)) b ORDER BY b
\gexec
RESET statement_timeout;
RESET log_min_duration_statement;
select 'end|' || clock_timestamp();
select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;
