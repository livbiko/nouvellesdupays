-- Build #121 West Africa Batch 2 (data only, MEDIUM). Reverse: reverse.sql.
-- 9 publishers: NE(+2) LR(+1) GM(+1) MR(+1) TG(+1) BJ(+2) CV(+1)
-- All feeds verified 2026-10-20/21.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;

-- Guard: ensure none of these slugs already exist
DO $guard$
DECLARE
  slugs text[] := ARRAY[
    'tamtaminfo','journalduniger','newdawn-liberia',
    'thepoint-gm','saharamedias','icilome',
    'beninwebtv','journaldubenin','expressodas-ilhas'
  ];
  already text[];
BEGIN
  SELECT array_agg(slug) INTO already FROM publishers WHERE slug = ANY(slugs);
  IF already IS NOT NULL AND array_length(already,1) > 0 THEN
    RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', array_length(already,1)
      USING HINT = array_to_string(already,',');
  END IF;
  IF EXISTS (
    SELECT 1 FROM publisher_submissions
    WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #121 West Africa batch 2]%'
  ) THEN
    RAISE EXCEPTION 'Build tag already present — apply.sql was already run';
  END IF;
END $guard$;

-- Country ID variables
DO $setup$
BEGIN
  -- declare country ids for reference
END $setup$;

-- ============================================================
-- NIGER (NE)
-- ============================================================

-- 1. Tamtaminfo — Niger's leading news site
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Tamtaminfo', 'tamtaminfo', 'https://tamtaminfo.com', c.id, 'fr', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'NE'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Niger news site. Feed: https://tamtaminfo.com/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='tamtaminfo')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://tamtaminfo.com/feed/', 'rss', 'fr', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='tamtaminfo')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','economy'], now(), now() FROM pub;

-- 2. Journal du Niger
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Journal du Niger', 'journalduniger', 'https://www.journalduniger.com', c.id, 'fr', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'NE'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Niger online newspaper. Feed: https://www.journalduniger.com/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='journalduniger')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://www.journalduniger.com/feed/', 'rss', 'fr', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='journalduniger')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','news'], now(), now() FROM pub;

-- ============================================================
-- LIBERIA (LR)
-- ============================================================

-- 3. New Dawn Liberia
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'New Dawn Liberia', 'newdawn-liberia', 'https://thenewdawnliberia.com', c.id, 'en', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'LR'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Leading Liberian daily newspaper. Feed: https://thenewdawnliberia.com/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='newdawn-liberia')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://thenewdawnliberia.com/feed/', 'rss', 'en', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='newdawn-liberia')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','business'], now(), now() FROM pub;

-- ============================================================
-- GAMBIA (GM)
-- ============================================================

-- 4. The Point Newspaper
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'The Point Newspaper', 'thepoint-gm', 'https://www.thepoint.gm', c.id, 'en', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'GM'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Leading Gambian newspaper. Feed: https://www.thepoint.gm/posts/rss/xml — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='thepoint-gm')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://www.thepoint.gm/posts/rss/xml', 'rss', 'en', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='thepoint-gm')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','news'], now(), now() FROM pub;

-- ============================================================
-- MAURITANIA (MR)
-- ============================================================

-- 5. Sahara Medias (Arabic)
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Sahara Medias', 'saharamedias', 'https://saharamedias.net', c.id, 'ar', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'MR'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Mauritanian Arabic news site. Feed: https://saharamedias.net/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='saharamedias')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://saharamedias.net/feed/', 'rss', 'ar', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='saharamedias')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','economy'], now(), now() FROM pub;

-- ============================================================
-- TOGO (TG)
-- ============================================================

-- 6. Icilome
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Icilome', 'icilome', 'https://www.icilome.com', c.id, 'fr', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'TG'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Togolese news site. Feed: https://www.icilome.com/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='icilome')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://www.icilome.com/feed/', 'rss', 'fr', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='icilome')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','economy'], now(), now() FROM pub;

-- ============================================================
-- BENIN (BJ)
-- ============================================================

-- 7. Benin Web TV
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Benin Web TV', 'beninwebtv', 'https://beninwebtv.bj', c.id, 'fr', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'BJ'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Leading Beninese online news outlet. Feed: https://beninwebtv.bj/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='beninwebtv')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://beninwebtv.bj/feed/', 'rss', 'fr', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='beninwebtv')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','society','culture'], now(), now() FROM pub;

-- 8. Journal du Benin
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Journal du Benin', 'journaldubenin', 'https://journaldubenin.com', c.id, 'fr', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'BJ'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Beninese online newspaper. Feed: https://journaldubenin.com/feed/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='journaldubenin')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://journaldubenin.com/feed/', 'rss', 'fr', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='journaldubenin')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','economy','society'], now(), now() FROM pub;

-- ============================================================
-- CAPE VERDE (CV)
-- ============================================================

-- 9. Expresso das Ilhas
WITH ins AS (
  INSERT INTO publishers (name, slug, website_url, country_id, language, feed_status, created_at, updated_at)
  SELECT 'Expresso das Ilhas', 'expressodas-ilhas', 'https://expressodasilhas.cv', c.id, 'pt', 'active', now(), now()
  FROM countries c WHERE c.iso_code = 'CV'
  RETURNING id
)
INSERT INTO publisher_submissions (publisher_id, submitted_by, status, verification_detail, created_at, updated_at)
SELECT ins.id, 'system', 'approved',
  'Cape Verde leading newspaper. Feed: https://expressodasilhas.cv/rss/ — verified 2026-10-20. [added by Claude 2026-10-21, Build #121 West Africa batch 2]',
  now(), now()
FROM ins;

WITH pub AS (SELECT id FROM publishers WHERE slug='expressodas-ilhas')
INSERT INTO feeds (publisher_id, url, feed_type, language, is_active, created_at, updated_at)
SELECT pub.id, 'https://expressodasilhas.cv/rss/', 'rss', 'pt', true, now(), now() FROM pub;

WITH pub AS (SELECT id FROM publishers WHERE slug='expressodas-ilhas')
INSERT INTO editorial_profiles (publisher_id, reach_tier, focus_areas, created_at, updated_at)
SELECT pub.id, 'regional', ARRAY['politics','economy','society'], now(), now() FROM pub;

-- ============================================================
-- Verification spot-check
-- ============================================================

SELECT 'count|' || count(*) || ' publishers added'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #121 West Africa batch 2]%';

SELECT 'countries|' || string_agg(DISTINCT c.iso_code, ',' ORDER BY c.iso_code) || ' covered'
  FROM publishers p JOIN countries c ON c.id = p.country_id
  WHERE p.slug IN (
    'tamtaminfo','journalduniger','newdawn-liberia',
    'thepoint-gm','saharamedias','icilome',
    'beninwebtv','journaldubenin','expressodas-ilhas'
  );

COMMIT;
-- Note: RAISE NOTICE after COMMIT must be in a DO block
DO $$ BEGIN RAISE NOTICE 'West Africa batch 2: 9 publishers added across NE LR GM MR TG BJ CV'; END $$;
