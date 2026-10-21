-- Build #121 West Africa Batch 2 (data only, MEDIUM). Reverse: reverse.sql.
-- 2 publishers: LR(+1) GM(+1)
-- Already in DB (africa-voices): tamtaminfo(NE), icilome(TG), beninwebtv(BJ), saharamedias(MR), expressodas-ilhas(CV)
-- Already in DB (profiles-yogam): journalduniger(NE), journaldubenin(BJ)
-- All feeds verified 2026-10-20/21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_lr  integer; v_gm  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #121 West Africa batch 2]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_lr FROM countries WHERE iso_code = 'LR';
  SELECT id INTO STRICT v_gm FROM countries WHERE iso_code = 'GM';

  -- Idempotency guard
  SELECT count(*) INTO bad FROM publishers WHERE slug IN ('newdawn-liberia','thepoint-gm');
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;
  -- Domain+country guard
  SELECT count(*) INTO bad FROM publishers p
  WHERE (p.country_id = v_lr AND p.domain IN ('thenewdawnliberia.com'))
     OR (p.country_id = v_gm AND p.domain IN ('thepoint.gm'));
  IF bad > 0 THEN RAISE EXCEPTION '% domain+country pair(s) already exist', bad; END IF;

  -- ================================================================
  -- LR-1: New Dawn Liberia
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('New Dawn Liberia','https://thenewdawnliberia.com/','https://thenewdawnliberia.com/feed/','rss',v_lr,'en',true,
    'Feed checked 2026-10-20: rss, active, ~15 items, newest same-day ' || build_tag,
    'thenewdawnliberia.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_lr,'New Dawn Liberia','https://thenewdawnliberia.com/','active','en','thenewdawnliberia.com','NEWSPAPER','newdawn-liberia','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://thenewdawnliberia.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Leading Liberian daily newspaper covering national politics, business and society.',
    'One of Liberia''s most prominent daily newspapers with regular digital updates.',
    'medium','Ownership details not fully documented; widely cited as a leading Liberian newspaper.',
    '[{"url":"https://thenewdawnliberia.com/","note":"Liberian daily newspaper, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- GM-1: The Point Newspaper
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('The Point Newspaper','https://www.thepoint.gm/','https://www.thepoint.gm/posts/rss/xml','rss',v_gm,'en',true,
    'Feed checked 2026-10-20: rss, active, ~15 items, newest same-day ' || build_tag,
    'thepoint.gm','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_gm,'The Point Newspaper','https://www.thepoint.gm/','active','en','thepoint.gm','NEWSPAPER','thepoint-gm','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.thepoint.gm/posts/rss/xml','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'The Gambia''s leading independent newspaper, established in the 1990s.',
    'One of the most prominent newspapers in The Gambia, covering national politics, society and economy.',
    'medium','Ownership details not fully documented; widely acknowledged as Gambia''s leading independent newspaper.',
    '[{"url":"https://www.thepoint.gm/","note":"Gambia leading newspaper, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  RAISE NOTICE 'West Africa batch 2: 2 publishers added (LR GM)';
END $do$;

SELECT 'added|' || count(*) || ' publishers tagged'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #121 West Africa batch 2]%';
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #121 West Africa batch 2]%';
