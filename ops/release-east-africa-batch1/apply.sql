-- Build #123 East Africa Batch 1 (data only, MEDIUM). Reverse: reverse.sql.
-- 4 publishers: TZ(+2) RW(+1) ET(+1)
-- Already in DB (africa-voices): standard-media-kenya(KE,ID 9), capital-fm-kenya(KE,ID 10),
--   watchdog-uganda(UG,ID 240), iwacu-burundi(BI,ID 248), eye-radio(SS,ID 265)
-- All feeds verified 2026-10-21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_tz  integer; v_rw  integer; v_et  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #123 East Africa batch 1]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_tz FROM countries WHERE iso_code = 'TZ';
  SELECT id INTO STRICT v_rw FROM countries WHERE iso_code = 'RW';
  SELECT id INTO STRICT v_et FROM countries WHERE iso_code = 'ET';

  -- Idempotency guard: slug check
  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'citizen-tanzania','mwananchi-tz','new-times-rwanda','fana-ethiopia'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  -- Build tag check
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;
  -- Domain+country guard
  SELECT count(*) INTO bad FROM publishers p
  WHERE (p.country_id = v_tz AND p.domain IN ('thecitizen.co.tz','mwananchi.co.tz'))
     OR (p.country_id = v_rw AND p.domain IN ('newtimes.co.rw'))
     OR (p.country_id = v_et AND p.domain IN ('fanamc.com'));
  IF bad > 0 THEN RAISE EXCEPTION '% domain+country pair(s) already exist — run check_domains.sql', bad; END IF;

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

  RAISE NOTICE 'East Africa batch 1: 4 publishers added across TZ RW ET';
END $do$;

SELECT 'count|' || count(*) || ' publishers added'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #123 East Africa batch 1]%';

SELECT 'countries|' || string_agg(DISTINCT c.iso_code, ',' ORDER BY c.iso_code) || ' covered'
  FROM publishers p JOIN countries c ON c.id = p.country_id
  WHERE p.slug IN ('citizen-tanzania','mwananchi-tz','new-times-rwanda','fana-ethiopia');

COMMIT;
