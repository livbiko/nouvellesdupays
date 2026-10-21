-- Build #121 West Africa Batch 2 (data only, MEDIUM). Reverse: reverse.sql.
-- 9 publishers: NE(+2) LR(+1) GM(+1) MR(+1) TG(+1) BJ(+2) CV(+1)
-- All feeds verified 2026-10-20/21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_ne  integer; v_lr  integer; v_gm  integer; v_mr  integer; v_tg  integer;
  v_bj  integer; v_cv  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #121 West Africa batch 2]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_ne FROM countries WHERE iso_code = 'NE';
  SELECT id INTO STRICT v_lr FROM countries WHERE iso_code = 'LR';
  SELECT id INTO STRICT v_gm FROM countries WHERE iso_code = 'GM';
  SELECT id INTO STRICT v_mr FROM countries WHERE iso_code = 'MR';
  SELECT id INTO STRICT v_tg FROM countries WHERE iso_code = 'TG';
  SELECT id INTO STRICT v_bj FROM countries WHERE iso_code = 'BJ';
  SELECT id INTO STRICT v_cv FROM countries WHERE iso_code = 'CV';

  -- Idempotency guard
  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'tamtaminfo','journalduniger','newdawn-liberia',
    'thepoint-gm','saharamedias','icilome',
    'beninwebtv','journaldubenin','expressodas-ilhas'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;

  -- ================================================================
  -- NE-1: Tamtaminfo
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Tamtaminfo','https://tamtaminfo.com/','https://tamtaminfo.com/feed/','rss',v_ne,'fr',true,
    'Feed checked 2026-10-20: rss, active, ~20 items, newest same-day ' || build_tag,
    'tamtaminfo.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ne,'Tamtaminfo','https://tamtaminfo.com/','active','fr','tamtaminfo.com','ONLINE_NEWS','tamtaminfo','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://tamtaminfo.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Nigerien online news portal covering politics, society and economy from Niamey.',
    'Active news portal in Niger with regular daily updates on national affairs.',
    'medium','Ownership not publicly documented; editorial character inferred from published content.',
    '[{"url":"https://tamtaminfo.com/","note":"Niger news portal, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- NE-2: Journal du Niger
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Journal du Niger','https://www.journalduniger.com/','https://www.journalduniger.com/feed/','rss',v_ne,'fr',true,
    'Feed checked 2026-10-20: rss, active, ~20 items, newest same-day ' || build_tag,
    'journalduniger.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ne,'Journal du Niger','https://www.journalduniger.com/','active','fr','journalduniger.com','ONLINE_NEWS','journalduniger','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.journalduniger.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Nigerien online newspaper covering national and international news.',
    'Active Nigerien news outlet publishing across politics, economy and society.',
    'medium','Ownership not publicly documented; editorial character inferred from published content.',
    '[{"url":"https://www.journalduniger.com/","note":"Niger online newspaper, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

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

  -- ================================================================
  -- MR-1: Sahara Medias (Arabic)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Sahara Medias','https://saharamedias.net/','https://saharamedias.net/feed/','rss',v_mr,'ar',true,
    'Feed checked 2026-10-20: rss, active, Arabic content, newest same-day ' || build_tag,
    'saharamedias.net','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_mr,'Sahara Medias','https://saharamedias.net/','active','ar','saharamedias.net','ONLINE_NEWS','saharamedias','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://saharamedias.net/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Mauritanian Arabic-language online news site covering politics and national affairs.',
    'One of the main Arabic-language news portals in Mauritania.',
    'medium','Ownership not publicly documented; Arabic-language editorial character confirmed.',
    '[{"url":"https://saharamedias.net/","note":"Mauritanian Arabic news portal, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- TG-1: Icilome
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Icilome','https://www.icilome.com/','https://www.icilome.com/feed/','rss',v_tg,'fr',true,
    'Feed checked 2026-10-20: rss, active, ~20 items, newest same-day ' || build_tag,
    'icilome.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_tg,'Icilome','https://www.icilome.com/','active','fr','icilome.com','ONLINE_NEWS','icilome','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.icilome.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Togolese online news portal covering politics, economy and society in Togo.',
    'Active Togolese news site with regular updates on national and regional affairs.',
    'medium','Ownership not publicly documented; editorial character inferred from published content.',
    '[{"url":"https://www.icilome.com/","note":"Togolese news portal, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- BJ-1: Benin Web TV
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Benin Web TV','https://beninwebtv.bj/','https://beninwebtv.bj/feed/','rss',v_bj,'fr',true,
    'Feed checked 2026-10-20: rss, active, ~20 items, newest same-day ' || build_tag,
    'beninwebtv.bj','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_bj,'Benin Web TV','https://beninwebtv.bj/','active','fr','beninwebtv.bj','TV','beninwebtv','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://beninwebtv.bj/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Leading Beninese online television and news outlet covering politics, society and culture.',
    'One of the most visited news sites in Benin, with both video and text news content.',
    'medium','Ownership details not fully documented; widely cited as a leading Beninese media outlet.',
    '[{"url":"https://beninwebtv.bj/","note":"Benin Web TV, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- BJ-2: Journal du Benin
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Journal du Benin','https://journaldubenin.com/','https://journaldubenin.com/feed/','rss',v_bj,'fr',true,
    'Feed checked 2026-10-20: rss, active, ~20 items, newest same-day ' || build_tag,
    'journaldubenin.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_bj,'Journal du Benin','https://journaldubenin.com/','active','fr','journaldubenin.com','ONLINE_NEWS','journaldubenin','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://journaldubenin.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Beninese online newspaper covering national politics, economy and society.',
    'Active Beninese news outlet with regular updates on national affairs.',
    'medium','Ownership details not publicly documented; editorial character inferred from content.',
    '[{"url":"https://journaldubenin.com/","note":"Benin online newspaper, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- CV-1: Expresso das Ilhas
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Expresso das Ilhas','https://expressodasilhas.cv/','https://expressodasilhas.cv/rss/','rss',v_cv,'pt',true,
    'Feed checked 2026-10-20: rss, active, ~15 items, newest same-day ' || build_tag,
    'expressodasilhas.cv','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_cv,'Expresso das Ilhas','https://expressodasilhas.cv/','active','pt','expressodasilhas.cv','NEWSPAPER','expressodas-ilhas','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://expressodasilhas.cv/rss/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Cape Verde leading Portuguese-language newspaper covering national politics, economy and society.',
    'One of the most prominent news outlets in Cape Verde with regular digital updates.',
    'medium','Widely acknowledged as a leading Cape Verdean newspaper; ownership details not fully documented.',
    '[{"url":"https://expressodasilhas.cv/","note":"Cape Verde newspaper, reviewed 2026-10-20","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  RAISE NOTICE 'West Africa batch 2: 9 publishers queued across NE LR GM MR TG BJ CV';
END $do$;

-- Verification spot-check
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
