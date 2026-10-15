-- Reverse of lang.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DO $$
DECLARE n int := 0; k int;
BEGIN
  UPDATE publishers SET language = 'en' WHERE id = 1054 AND language = 'ar'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  UPDATE publishers SET language = 'fr' WHERE id = 1537 AND language = 'en'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 publishers at their starting language, updated %', n; END IF;
END $$;
COMMIT;
select 'lang|' || string_agg(id || '=' || coalesce(language, '-'), ' ' ORDER BY id) FROM publishers WHERE id IN (1054, 1537);
