-- Read-only: current languages, column type/constraints, and a rehearsal of lang.sql + lang-reverse.sql inside one rolled-back transaction.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
select 'lang|' || string_agg(id || '=' || coalesce(language, '-') || ' ' || left(name, 20), ' ; ' ORDER BY id) FROM publishers WHERE id IN (1054, 1537);
select 'col|' || data_type || '|' || coalesce(character_maximum_length::text, '-') FROM information_schema.columns WHERE table_name = 'publishers' AND column_name = 'language';
select 'con|' || conname || '|' || pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'publishers'::regclass AND pg_get_constraintdef(oid) ILIKE '%language%';
select 'trg|' || tgname FROM pg_trigger WHERE tgrelid = 'publishers'::regclass AND NOT tgisinternal;
select 'langs|' || string_agg(DISTINCT language, ' ') FROM publishers WHERE language IN ('sw', 'ar', 'dv');
BEGIN;
DO $$
DECLARE n int := 0; k int;
BEGIN
  UPDATE publishers SET language = 'ar' WHERE id = 1054 AND language = 'en'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  UPDATE publishers SET language = 'en' WHERE id = 1537 AND language = 'fr'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 publishers at their starting language, updated %', n; END IF;
END $$;
select 'rehearsed|' || string_agg(id || '=' || language, ' ' ORDER BY id) FROM publishers WHERE id IN (1054, 1537);
ROLLBACK;
select 'after-rollback|' || string_agg(id || '=' || language, ' ' ORDER BY id) FROM publishers WHERE id IN (1054, 1537);
