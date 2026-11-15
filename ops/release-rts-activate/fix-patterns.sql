-- Build #253 follow-up (same build, 11-15 01:2x): the first crawl (01:15:58) stored 18 rows, 9 of them not articles -
-- 8 video bulletin pages (/dernierevideo/..., one from April) and /emissions/au-coeur-des-joj-le-journal stored with the
-- headline "Switch to dark mode". Restrict source 8898 to /actualite/detail/* (tested offline against all 18 URLs) and
-- delete those 9 rows. Guarded: publisher 8900, path outside /actualite/detail/, fetched by this build's first crawl.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET article_url_patterns = ARRAY['/actualite/detail/*'] WHERE id = 8898 AND article_url_patterns = '{}';
DELETE FROM articles
 WHERE publisher_id = 8900 AND original_url NOT LIKE 'https://www.rts.sn/actualite/detail/%'
   AND fetched_at >= '2026-11-15 01:13:00+00';
DO $$ BEGIN
  IF (SELECT count(*) FROM articles WHERE publisher_id = 8900) <> 9 THEN RAISE EXCEPTION 'expected 9 RTS articles left'; END IF;
END $$;
SELECT id, article_url_patterns FROM feeds WHERE id = 8898;
SELECT count(*) AS rts_articles FROM articles WHERE publisher_id = 8900;
COMMIT;
