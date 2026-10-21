-- Build #123 East Africa Batch 1 (data only, MEDIUM). Reverse: reverse.sql.
-- 9 publishers: KE(+2) TZ(+2) RW(+1) UG(+1) BI(+1) SS(+1) ET(+1)
-- All feeds verified 2026-10-21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_ke  integer; v_tz  integer; v_rw  integer; v_ug  integer;
  v_bi  integer; v_ss  integer; v_et  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #123 East Africa batch 1]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_ke FROM countries WHERE iso_code = 'KE';
  SELECT id INTO STRICT v_tz FROM countries WHERE iso_code = 'TZ';
  SELECT id INTO STRICT v_rw FROM countries WHERE iso_code = 'RW';
  SELECT id INTO STRICT v_ug FROM countries WHERE iso_code = 'UG';
  SELECT id INTO STRICT v_bi FROM countries WHERE iso_code = 'BI';
  SELECT id INTO STRICT v_ss FROM countries WHERE iso_code = 'SS';
  SELECT id INTO STRICT v_et FROM countries WHERE iso_code = 'ET';

  -- Idempotency guard: slug check
  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  -- Build tag check
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;
  -- Domain+country guard (avoids idx_publishers_country_domain unique violation)
  SELECT count(*) INTO bad FROM publishers p
  WHERE (p.country_id = v_ke AND p.domain IN ('standardmedia.co.ke','capitalfm.africa'))
     OR (p.country_id = v_tz AND p.domain IN ('thecitizen.co.tz','mwananchi.co.tz'))
     OR (p.country_id = v_rw AND p.domain IN ('newtimes.co.rw'))
     OR (p.country_id = v_ug AND p.domain IN ('watchdoguganda.com'))
     OR (p.country_id = v_bi AND p.domain IN ('iwacu-burundi.org'))
     OR (p.country_id = v_ss AND p.domain IN ('eyeradio.org'))
     OR (p.country_id = v_et AND p.domain IN ('fanamc.com'));
  IF bad > 0 THEN RAISE EXCEPTION '% domain+country pair(s) already exist — run check_domains.sql to identify conflicts', bad; END IF;

  -- ================================================================
  -- KE-1: Standard Media Kenya
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Standard Media Kenya','https://www.standardmedia.co.ke/','https://www.standardmedia.co.ke/rss/headlines.php','rss',v_ke,'en',true,
    'Feed checked 2026-10-21: rss, active, 26 items, newest same-day ' || build_tag,
    'standardmedia.co.ke','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ke,'Standard Media Kenya','https://www.standardmedia.co.ke/','active','en','standardmedia.co.ke','NEWSPAPER','standard-media-kenya','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.standardmedia.co.ke/rss/headlines.php','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Standard Group Limited',ARRAY['commercial_generalist']::text[],NULL,
    'One of Kenya''s oldest and most established newspapers, The Standard was founded in 1902. Part of the Standard Group conglomerate, which includes KTN television and Radio Maisha.',
    'Covers national politics, business, sports and culture in Kenya. One of the country''s two leading newspaper groups alongside Nation Media Group.',
    'high','Standard Group Limited ownership and 1902 founding widely documented.',
    '[{"url":"https://en.wikipedia.org/wiki/The_Standard_(Kenya)","note":"Founded 1902, Standard Group Limited","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- KE-2: Capital FM Kenya
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Capital FM Kenya','https://capitalfm.africa/','https://capitalfm.africa/news/feed/','rss',v_ke,'en',true,
    'Feed checked 2026-10-21: rss, active, 9 items, newest same-day (redirected from capitalfm.co.ke to capitalfm.africa) ' || build_tag,
    'capitalfm.africa','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ke,'Capital FM Kenya','https://capitalfm.africa/','active','en','capitalfm.africa','RADIO','capital-fm-kenya','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://capitalfm.africa/news/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Radio Africa Group',ARRAY['commercial_generalist']::text[],NULL,
    'Kenyan radio station and digital news platform owned by Radio Africa Group. Capital FM is one of Kenya''s leading commercial radio stations.',
    'Covers Kenyan and regional news, business, sports and entertainment from Nairobi.',
    'medium','Radio Africa Group ownership confirmed via site; Capital FM brand widely known in Kenya.',
    '[{"url":"https://capitalfm.africa/","note":"Capital FM Kenya, Radio Africa Group, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- TZ-1: The Citizen Tanzania
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('The Citizen Tanzania','https://www.thecitizen.co.tz/','https://www.thecitizen.co.tz/service/rss/tanzania/2486554/feed.rss','rss',v_tz,'en',true,
    'Feed checked 2026-10-21: rss, active, 25 items, newest same-day ' || build_tag,
    'thecitizen.co.tz','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_tz,'The Citizen Tanzania','https://www.thecitizen.co.tz/','active','en','thecitizen.co.tz','NEWSPAPER','citizen-tanzania','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.thecitizen.co.tz/service/rss/tanzania/2486554/feed.rss','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Mwananchi Communications Ltd / Nation Media Group',ARRAY['commercial_generalist']::text[],NULL,
    'Tanzania''s leading English-language daily newspaper, published by Mwananchi Communications Ltd, a subsidiary of Nation Media Group (founded by Aga Khan).',
    'Covers national politics, business, society and culture. Widely considered Tanzania''s most authoritative English-language newspaper.',
    'high','Nation Media Group / Mwananchi Communications Ltd ownership well documented.',
    '[{"url":"https://www.thecitizen.co.tz/","note":"Tanzania English newspaper, Nation Media Group subsidiary, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- TZ-2: Mwananchi (Swahili)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Mwananchi','https://www.mwananchi.co.tz/','https://www.mwananchi.co.tz/service/rss/mw/2733734/feed.rss','rss',v_tz,'sw',true,
    'Feed checked 2026-10-21: rss, active, 20 items, newest same-day (Swahili) ' || build_tag,
    'mwananchi.co.tz','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_tz,'Mwananchi','https://www.mwananchi.co.tz/','active','sw','mwananchi.co.tz','NEWSPAPER','mwananchi-tz','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.mwananchi.co.tz/service/rss/mw/2733734/feed.rss','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Mwananchi Communications Ltd / Nation Media Group',ARRAY['commercial_generalist']::text[],NULL,
    'Tanzania''s leading Swahili-language daily newspaper, also published by Mwananchi Communications Ltd (Nation Media Group).',
    'Sister publication to The Citizen Tanzania, covering national and regional news in Swahili for a mass Tanzanian audience.',
    'high','Mwananchi Communications Ltd / Nation Media Group ownership well documented.',
    '[{"url":"https://www.mwananchi.co.tz/","note":"Tanzania Swahili newspaper, Nation Media Group subsidiary, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- RW-1: The New Times Rwanda
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('The New Times Rwanda','https://www.newtimes.co.rw/','https://www.newtimes.co.rw/rssFeed/14','rss',v_rw,'en',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest same-day ' || build_tag,
    'newtimes.co.rw','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_rw,'The New Times Rwanda','https://www.newtimes.co.rw/','active','en','newtimes.co.rw','NEWSPAPER','new-times-rwanda','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.newtimes.co.rw/rssFeed/14','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'state','Government of Rwanda',ARRAY['government_aligned']::text[],NULL,
    'Rwanda''s leading English-language newspaper, majority-owned by the Government of Rwanda. Founded in 1995 following the genocide, it serves as Rwanda''s primary national newspaper.',
    'Government-owned English-language paper of record. Covers national policies, economic development, regional affairs and culture.',
    'high','Government of Rwanda ownership of The New Times is widely documented.',
    '[{"url":"https://en.wikipedia.org/wiki/The_New_Times_(Rwanda)","note":"Government of Rwanda majority ownership","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- UG-1: Watchdog Uganda
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Watchdog Uganda','https://www.watchdoguganda.com/','https://www.watchdoguganda.com/feed','rss',v_ug,'en',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest same-day ' || build_tag,
    'watchdoguganda.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ug,'Watchdog Uganda','https://www.watchdoguganda.com/','active','en','watchdoguganda.com','ONLINE_NEWS','watchdog-uganda','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.watchdoguganda.com/feed','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Ugandan online news portal covering politics, security, business, tourism, technology and education.',
    'Active Ugandan digital news outlet providing trending news and commentary.',
    'low','Ownership details not publicly documented; editorial character inferred from published content.',
    '[{"url":"https://www.watchdoguganda.com/","note":"Uganda online news portal, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- BI-1: IWACU Burundi
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('IWACU','https://www.iwacu-burundi.org/','https://www.iwacu-burundi.org/feed/','rss',v_bi,'fr',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest same-day ' || build_tag,
    'iwacu-burundi.org','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_bi,'IWACU','https://www.iwacu-burundi.org/','active','fr','iwacu-burundi.org','INVESTIGATIVE','iwacu-burundi','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.iwacu-burundi.org/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'independent','Antoine Kaburahe / IWACU Foundation',ARRAY['independent']::text[],NULL,
    'Burundi''s leading independent news magazine, founded in 2007 by journalist Antoine Kaburahe. Known as "Les voix du Burundi." Has faced significant government pressure and staff arrests.',
    'Independent Burundian news outlet covering politics, society, economics and human rights. Despite operating under difficult press freedom conditions, continues to publish critical reporting.',
    'high','Founding by Antoine Kaburahe and independent editorial stance widely documented; multiple press freedom reports reference IWACU.',
    '[{"url":"https://en.wikipedia.org/wiki/Iwacu","note":"Independent Burundian news magazine, founded 2007","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- SS-1: Eye Radio (South Sudan)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Eye Radio','https://eyeradio.org/','https://eyeradio.org/feed/','rss',v_ss,'en',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest same-day ' || build_tag,
    'eyeradio.org','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ss,'Eye Radio','https://eyeradio.org/','active','en','eyeradio.org','RADIO','eye-radio','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://eyeradio.org/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'ngo','Internews',ARRAY['independent']::text[],NULL,
    'South Sudan''s leading independent radio station, founded in 2005 with support from Internews, an international media development NGO. Based in Juba.',
    'One of the few independent news sources in South Sudan, covering politics, conflict, humanitarian affairs and development.',
    'high','Internews founding support and independent editorial stance documented in multiple sources.',
    '[{"url":"https://eyeradio.org/about/","note":"Eye Radio South Sudan, founded 2005 with Internews support","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- ET-1: Fana Media Corporation (Ethiopia)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Fana Media Corporation','https://www.fanamc.com/english/','https://www.fanamc.com/english/feed/','rss',v_et,'en',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest Oct 20 2026 ' || build_tag,
    'fanamc.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_et,'Fana Media Corporation','https://www.fanamc.com/english/','active','en','fanamc.com','TV','fana-ethiopia','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.fanamc.com/english/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'state','Ethiopian Government / Ethiopian Broadcasting Authority',ARRAY['government_aligned']::text[],NULL,
    'Fana Broadcasting Corporate S.C. (now Fana Media Corporation) is Ethiopia''s main government-owned broadcasting company, established in 1996. Operates radio, television and digital news.',
    'State broadcaster covering Ethiopian politics, economics, diplomacy and culture from a pro-government perspective.',
    'high','State ownership of Fana Broadcasting by Ethiopian government is well documented.',
    '[{"url":"https://en.wikipedia.org/wiki/Fana_Broadcasting_Corporate","note":"Ethiopian state broadcaster, government-owned","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  RAISE NOTICE 'East Africa batch 1: 9 publishers queued across KE TZ RW UG BI SS ET';
END $do$;

-- Verification spot-check
SELECT 'count|' || count(*) || ' publishers added'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #123 East Africa batch 1]%';

SELECT 'countries|' || string_agg(DISTINCT c.iso_code, ',' ORDER BY c.iso_code) || ' covered'
  FROM publishers p JOIN countries c ON c.id = p.country_id
  WHERE p.slug IN (
    'standard-media-kenya','capital-fm-kenya',
    'citizen-tanzania','mwananchi-tz',
    'new-times-rwanda','watchdog-uganda',
    'iwacu-burundi','eye-radio','fana-ethiopia'
  );

COMMIT;
