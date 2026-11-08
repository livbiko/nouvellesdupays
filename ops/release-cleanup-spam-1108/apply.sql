-- Build #193: Business Bhutan spam that passed the Build #190 filter. "Boomerang Bet Support: So löst du Kontoprobleme..."
-- (11-08 00:31; the filter has betting but not bet) and "Coronavirus disease 2019" (11-03, posted by kaia54591, the
-- account behind the 11-07 "jeu responsable" post). Every real Business Bhutan article is by the site's own account
-- 'businessbhutan'; the spam comes from wps_ebe76b6454 and kaia54591. Delete their rows and add bet to feed 1020's
-- title filter. Get-ChangeRisk said HIGH (likely "author" read as auth); run only in the approved window.
-- Owner: "do A now and prepare B". rehearse.sql is this file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE tgt (id bigint PRIMARY KEY, action text NOT NULL);
INSERT INTO tgt SELECT id, 'delete-bt-spam-account' FROM articles
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan') AND author IN ('wps_ebe76b6454', 'kaia54591');
\echo ===COUNTS===
SELECT action, count(*) FROM tgt GROUP BY 1 ORDER BY 1;
-- Expected on 11-08 04:30: 2 (more may arrive before the filter is in).
DO $do$
DECLARE n_bt int;
BEGIN
  SELECT count(*) INTO n_bt FROM tgt;
  IF n_bt NOT BETWEEN 2 AND 5 THEN
    RAISE EXCEPTION 'Target count outside the expected range (%) - nothing changed', n_bt;
  END IF;
END $do$;
\echo ===STATE-BEFORE===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
\echo ===TARGETS===
SELECT t.action, a.id, a.fetched_at, a.author, left(a.headline, 100) FROM articles a JOIN tgt t ON t.id = a.id ORDER BY 1, 3;
\echo ===CSV-BEGIN===
COPY (SELECT t.action, a.* FROM articles a JOIN tgt t ON t.id = a.id ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===CSV-END===
DELETE FROM articles WHERE id IN (SELECT id FROM tgt);
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(parser_config ->> 'exclude_title_pattern', '|slots?|', '|bet|slots?|'))
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
                   AND strpos(parser_config ->> 'exclude_title_pattern', '|bet|slots?|') > 0) THEN
    RAISE EXCEPTION 'Filter pattern was not updated - nothing changed';
  END IF;
END $do$;
\echo ===AFTER===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug = 'business-bhutan' ORDER BY f.id;
SELECT 'left', count(*) FROM articles WHERE id IN (SELECT id FROM tgt);
COMMIT;
