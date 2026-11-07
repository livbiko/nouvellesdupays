-- Build #190 (MEDIUM): two spam posts reached Business Bhutan on 11-07 00:30 UTC past the Build #185 filter --
-- "CookieCasino" (casino mid-word, the filter only matched it at a word start) and a French "jeu responsable" post.
-- Delete them and widen feed 1020's filter. Owner approved 2026-11-07. This is rehearse.sql: apply.sql with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE tgt (id bigint PRIMARY KEY, action text NOT NULL);
INSERT INTO tgt SELECT id, 'delete-bt-spam' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
  AND headline ~* $p$casino|jeu responsable|uitbetaling$p$;
\echo ===COUNTS===
SELECT action, count(*) FROM tgt GROUP BY 1 ORDER BY 1;
-- Expected on 11-07 04:30: 2 (more may arrive before the filter is in).
DO $do$
DECLARE n_bt int;
BEGIN
  SELECT count(*) INTO n_bt FROM tgt;
  IF n_bt NOT BETWEEN 2 AND 4 THEN
    RAISE EXCEPTION 'Target count outside the expected range (%) - nothing changed', n_bt;
  END IF;
END $do$;
\echo ===STATE-BEFORE===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
\echo ===TARGETS===
SELECT t.action, a.id, a.fetched_at, left(a.headline, 100) FROM articles a JOIN tgt t ON t.id = a.id ORDER BY 1, 3;
\echo ===CSV-BEGIN===
COPY (SELECT t.action, a.* FROM articles a JOIN tgt t ON t.id = a.id ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===CSV-END===
DELETE FROM articles WHERE id IN (SELECT id FROM tgt);
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(parser_config ->> 'exclude_title_pattern', '\b(?:casino\w*|', '\b(?:\w*casino\w*|jeu responsable|uitbetaling\w*|'))
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
                   AND starts_with(parser_config ->> 'exclude_title_pattern', '\b(?:\w*casino\w*|jeu responsable|uitbetaling\w*|')) THEN
    RAISE EXCEPTION 'Filter pattern was not updated - nothing changed';
  END IF;
END $do$;
\echo ===AFTER===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
SELECT 'left', count(*) FROM articles WHERE id IN (SELECT id FROM tgt);
ROLLBACK;
