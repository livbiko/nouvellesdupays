-- Build #160 (HIGH, maintenance window): clean up articles filed under the wrong publisher by the shared-parser bug
-- (fixed in Build #159) and spam from three compromised publishers. Owner approved the plan 2026-11-05 ("approve both").
-- One transaction: pick the target rows, check the counts, print every target row as CSV (the record to restore
-- from), then change. rehearse.sql is this file with ROLLBACK. Nothing references articles by foreign key.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '300s';
BEGIN;
CREATE TEMP TABLE d AS
  SELECT DISTINCT ON (lower(regexp_replace(domain, '^www\.', ''))) lower(regexp_replace(domain, '^www\.', '')) dom, id pid
  FROM publishers WHERE domain IS NOT NULL ORDER BY 1, id;
-- Rows under La Prensa / Madagascar Tribune whose URL host is exactly another carried publisher's domain.
CREATE TEMP TABLE mis AS
  SELECT a.id, a.original_url, d.pid cpid
  FROM articles a JOIN publishers p ON p.id = a.publisher_id
  JOIN d ON d.dom = lower(regexp_replace(substring(a.original_url from '^https?://([^/:]+)'), '^www\.', '')) AND d.pid <> a.publisher_id
  WHERE p.slug IN ('la-prensa-panama', 'madagascar-tribune');
ANALYZE mis;
-- ... that the right publisher already holds under the same URL.
CREATE TEMP TABLE cp AS SELECT DISTINCT m.id FROM mis m JOIN articles b ON b.publisher_id = m.cpid AND b.original_url = m.original_url;
CREATE TEMP TABLE tgt (id bigint PRIMARY KEY, action text NOT NULL);
INSERT INTO tgt SELECT id, 'delete-misfiled' FROM cp;
INSERT INTO tgt SELECT id, 'reassign-misfiled' FROM mis WHERE id NOT IN (SELECT id FROM cp);
INSERT INTO tgt SELECT id, 'delete-islaminfo' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'islaminfo') ON CONFLICT DO NOTHING;
INSERT INTO tgt SELECT id, 'delete-bt-spam' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan')
  AND headline ~* $p$\m(casinos?|slots?|sportsbook|betting|poker|jackpot|bonus(es)?|bonos|bónusz|boni|spins?|spin\w+|kazino|kasyno|roobet|boabet|lucky8|melbet|1xbet\w*|1win|parimatch|premier bet|aviator bet|betzino|likesbet|fixbet|gransino|golden panda|prince ali|joueurs|játékos\w*|glücksspiel\w*|gambling|wagering|apk|code promo|promo code|onlyfans)\M|[А-Яа-яЁёІіЇїЄєҐґ]$p$ ON CONFLICT DO NOTHING;
INSERT INTO tgt SELECT id, 'delete-leadership-spam' FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'leadership')
  AND headline ~ '[ก-๙]' ON CONFLICT DO NOTHING;
\echo ===COUNTS===
SELECT action, count(*) FROM tgt GROUP BY 1 ORDER BY 1;
SELECT 'reassign targets without a feed', count(*) FROM mis m WHERE m.id IN (SELECT id FROM tgt WHERE action = 'reassign-misfiled')
  AND NOT EXISTS (SELECT 1 FROM feeds f WHERE f.publisher_id = m.cpid);
-- Expected on 11-05 03:55: 1,835 / 34 / 105 / 75 / 3 (misfiled counts may grow a little until #159 is live).
DO $do$
DECLARE n_del int; n_re int; n_isl int; n_bt int; n_ld int;
BEGIN
  SELECT count(*) FILTER (WHERE action = 'delete-misfiled'), count(*) FILTER (WHERE action = 'reassign-misfiled'),
         count(*) FILTER (WHERE action = 'delete-islaminfo'), count(*) FILTER (WHERE action = 'delete-bt-spam'),
         count(*) FILTER (WHERE action = 'delete-leadership-spam')
    INTO n_del, n_re, n_isl, n_bt, n_ld FROM tgt;
  IF n_del NOT BETWEEN 1700 AND 2300 OR n_re > 80 OR n_isl NOT BETWEEN 100 AND 130 OR n_bt NOT BETWEEN 70 AND 110 OR n_ld NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'Target counts outside the expected ranges (% / % / % / % / %) - nothing changed', n_del, n_re, n_isl, n_bt, n_ld;
  END IF;
END $do$;
\echo ===STATE-BEFORE===
SELECT 'publisher', id, slug, feed_status FROM publishers WHERE slug = 'islaminfo';
SELECT 'feed', id, coalesce(parser_config::text, 'null') FROM feeds WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
\echo ===CSV-BEGIN===
COPY (SELECT t.action, a.* FROM articles a JOIN tgt t ON t.id = a.id ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===CSV-END===
UPDATE articles a SET publisher_id = m.cpid, country_id = p.country_id,
       feed_id = coalesce((SELECT min(f.id) FROM feeds f WHERE f.publisher_id = m.cpid), a.feed_id)
  FROM mis m JOIN publishers p ON p.id = m.cpid
  WHERE a.id = m.id AND a.id IN (SELECT id FROM tgt WHERE action = 'reassign-misfiled');
DELETE FROM articles WHERE id IN (SELECT id FROM tgt WHERE action LIKE 'delete-%');
UPDATE publishers SET feed_status = 'unavailable' WHERE slug = 'islaminfo';
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || jsonb_build_object('exclude_title_pattern', $j$\b(?:casinos?|slots?|sportsbook|betting|poker|jackpot|bonus(?:es)?|bonos|bónusz|boni|spins?|spin\w+|kazino|kasyno|roobet|boabet|lucky8|melbet|1xbet\w*|1win|parimatch|premier bet|aviator bet|betzino|likesbet|fixbet|gransino|golden panda|prince ali|joueurs|játékos\w*|glücksspiel\w*|gambling|wagering|apk|code promo|promo code|onlyfans)\b|[А-Яа-яЁёІіЇїЄєҐґ]$j$)
  WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
\echo ===AFTER===
SELECT 'still misfiled under la-prensa/mg-tribune', count(*) FROM articles a JOIN publishers p ON p.id = a.publisher_id
  JOIN d ON d.dom = lower(regexp_replace(substring(a.original_url from '^https?://([^/:]+)'), '^www\.', '')) AND d.pid <> a.publisher_id
  WHERE p.slug IN ('la-prensa-panama', 'madagascar-tribune');
SELECT 'islaminfo', feed_status, (SELECT count(*) FROM articles WHERE publisher_id = p.id) FROM publishers p WHERE slug = 'islaminfo';
SELECT 'bt spam left', count(*) FROM articles WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan') AND headline ~* $p$\m(casinos?|slots?|sportsbook|betting|poker|jackpot|bonus(es)?|bonos|bónusz|boni|spins?|spin\w+|kazino|kasyno|roobet|boabet|lucky8|melbet|1xbet\w*|1win|parimatch|premier bet|aviator bet|betzino|likesbet|fixbet|gransino|golden panda|prince ali|joueurs|játékos\w*|glücksspiel\w*|gambling|wagering|apk|code promo|promo code|onlyfans)\M|[А-Яа-яЁёІіЇїЄєҐґ]$p$;
SELECT 'bt feed parser_config', parser_config ->> 'exclude_title_pattern' = $j$\b(?:casinos?|slots?|sportsbook|betting|poker|jackpot|bonus(?:es)?|bonos|bónusz|boni|spins?|spin\w+|kazino|kasyno|roobet|boabet|lucky8|melbet|1xbet\w*|1win|parimatch|premier bet|aviator bet|betzino|likesbet|fixbet|gransino|golden panda|prince ali|joueurs|játékos\w*|glücksspiel\w*|gambling|wagering|apk|code promo|promo code|onlyfans)\b|[А-Яа-яЁёІіЇїЄєҐґ]$j$ FROM feeds WHERE publisher_id = (SELECT id FROM publishers WHERE slug = 'business-bhutan');
ROLLBACK;
