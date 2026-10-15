-- Corrects publishers.language for 2 publishers (one short transaction; aborts unless both are at their current value).
-- 1054 Yemen Monitor en->ar, 1537 Le Nouvelliste fr->en (its /rss serves English). 244/6748 stay en (see gen-mapping.js).
-- Reverse: lang-reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DO $$
DECLARE n int := 0; k int;
BEGIN
  UPDATE publishers SET language = 'ar' WHERE id = 1054 AND language = 'en'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  UPDATE publishers SET language = 'en' WHERE id = 1537 AND language = 'fr'; GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 publishers at their starting language, updated %', n; END IF;
END $$;
COMMIT;
select 'lang|' || string_agg(id || '=' || coalesce(language, '-'), ' ' ORDER BY id) FROM publishers WHERE id IN (1054, 1537);
