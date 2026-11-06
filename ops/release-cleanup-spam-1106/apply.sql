-- Build #185 (MEDIUM): delete spam that reached two compromised publishers after Build #160, and filter it at the feed.
-- Leadership (leadership.ng) had no filter and got Thai gambling posts; Business Bhutan's filter missed "Casinova"
-- and Turkish weather spam ("Havadurumu24"). Owner approved 2026-11-06 ("go next"). rehearse.sql is this file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE tgt (id bigint PRIMARY KEY, action text NOT NULL);
INSERT INTO tgt SELECT id, 'delete-leadership-thai' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'leadership')
  AND headline ~ '[ก-๙]';
INSERT INTO tgt SELECT id, 'delete-bt-spam' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
  AND headline ~* $p$\m(casino\w*|havadurumu\w*)\M$p$ ON CONFLICT DO NOTHING;
\echo ===COUNTS===
SELECT action, count(*) FROM tgt GROUP BY 1 ORDER BY 1;
-- Expected on 11-06 14:10: 4 / 2 (more may arrive before the filters are in).
DO $do$
DECLARE n_ld int; n_bt int;
BEGIN
  SELECT count(*) FILTER (WHERE action = 'delete-leadership-thai'), count(*) FILTER (WHERE action = 'delete-bt-spam') INTO n_ld, n_bt FROM tgt;
  IF n_ld NOT BETWEEN 4 AND 10 OR n_bt NOT BETWEEN 2 AND 6 THEN
    RAISE EXCEPTION 'Target counts outside the expected ranges (% / %) - nothing changed', n_ld, n_bt;
  END IF;
END $do$;
\echo ===STATE-BEFORE===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug IN ('leadership', 'business-bhutan') ORDER BY f.id;
\echo ===TARGETS===
SELECT t.action, a.id, a.fetched_at, left(a.headline, 100) FROM articles a JOIN tgt t ON t.id = a.id ORDER BY 1, 3;
\echo ===CSV-BEGIN===
COPY (SELECT t.action, a.* FROM articles a JOIN tgt t ON t.id = a.id ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===CSV-END===
DELETE FROM articles WHERE id IN (SELECT id FROM tgt);
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || jsonb_build_object('exclude_title_pattern', $j$[ก-๙]$j$)
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'leadership');
UPDATE feeds SET parser_config = parser_config || jsonb_build_object('exclude_title_pattern',
    replace(replace(parser_config ->> 'exclude_title_pattern', 'casinos?|', 'casino\w*|'), '|onlyfans)', '|onlyfans|havadurumu\w*)'))
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
\echo ===AFTER===
SELECT 'feed', f.id, p.slug, coalesce(f.parser_config::text, 'null') FROM feeds f JOIN publishers p ON p.id = f.publisher_id
  WHERE p.slug IN ('leadership', 'business-bhutan') ORDER BY f.id;
SELECT 'left', count(*) FROM articles WHERE id IN (SELECT id FROM tgt);
COMMIT;
