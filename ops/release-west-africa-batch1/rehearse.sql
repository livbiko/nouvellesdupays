-- Build #120 West Africa Batch 1 (data only, MEDIUM). Reverse: reverse.sql.
-- 5 publishers: GH(+1) NG(+2) SN(+2)
-- Already in DB (different slug, same domain): aip-ci, connectionivoirienne, 3news-ghana, premium-times-nigeria, lefaso
-- All feeds verified 2026-10-21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_gh  integer; v_ng  integer; v_sn  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #120 West Africa batch 1]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_gh FROM countries WHERE iso_code = 'GH';
  SELECT id INTO STRICT v_ng FROM countries WHERE iso_code = 'NG';
  SELECT id INTO STRICT v_sn FROM countries WHERE iso_code = 'SN';

  -- Idempotency: fail if any slug already exists or build already applied
  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'adom-online','tribune-online-nigeria','sahara-reporters','rewmi','xibaaru'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;
  -- Also fail if any (country, domain) pair already exists (idx_publishers_country_domain)
  SELECT count(*) INTO bad FROM publishers p
  WHERE (p.country_id = v_gh AND p.domain IN ('adomonline.com'))
     OR (p.country_id = v_ng AND p.domain IN ('tribuneonlineng.com','saharareporters.com'))
     OR (p.country_id = v_sn AND p.domain IN ('rewmi.com','xibaaru.sn'));
  IF bad > 0 THEN RAISE EXCEPTION 'One or more (country,domain) pairs already exist (% found) — remove conflicting publishers', bad; END IF;

  -- ================================================================
  -- GH-1: Adom Online
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Adom Online','https://www.adomonline.com/','https://adomonline.com/feed/','rss',v_gh,'en',true,
    'Feed checked 2026-10-21: rss, active, ~30 items, newest <2h ' || build_tag,
    'adomonline.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_gh,'Adom Online','https://www.adomonline.com/','active','en','adomonline.com','ONLINE_NEWS','adom-online','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://adomonline.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Multimedia Group Ltd',ARRAY['commercial_generalist']::text[],NULL,
    'Digital portal of Adom FM, part of Multimedia Group Ltd. Sister outlet to MyJoyOnline. Particularly popular with Twi-speaking Ghanaian audiences.',
    'Covers national news, entertainment, sports and culture. High-traffic site within Ghana''s digital media landscape.',
    'high','Multimedia Group Ltd ownership widely documented; Adom FM/Adom Online relationship confirmed on the site.',
    '[{"url":"https://www.adomonline.com/","note":"Adom FM / Multimedia Group Ltd, confirmed on-site","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- NG-1: Tribune Online (Nigerian Tribune)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Tribune Online','https://tribuneonlineng.com/','https://tribuneonlineng.com/feed/','rss',v_ng,'en',true,
    'Feed checked 2026-10-21: rss, active, ~30 items, newest <2h ' || build_tag,
    'tribuneonlineng.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ng,'Tribune Online','https://tribuneonlineng.com/','active','en','tribuneonlineng.com','NEWSPAPER','tribune-online-nigeria','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://tribuneonlineng.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','African Newspapers of Nigeria Plc / Awolowo Foundation',ARRAY['commercial_generalist']::text[],NULL,
    'Digital portal of Nigerian Tribune, Nigeria''s oldest surviving private newspaper, founded in 1949 by Chief Obafemi Awolowo in Ibadan.',
    'One of Nigeria''s most established news brands. Covers national politics, governance, economy, sports and culture.',
    'high','Nigerian Tribune''s 1949 founding and Awolowo Foundation/African Newspapers of Nigeria Plc ownership are widely documented.',
    '[{"url":"https://en.wikipedia.org/wiki/Nigerian_Tribune","note":"Founded 1949 by Obafemi Awolowo; African Newspapers of Nigeria Plc","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- NG-2: Sahara Reporters
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Sahara Reporters','https://saharareporters.com/','https://saharareporters.com/rss.xml','rss',v_ng,'en',true,
    'Feed checked 2026-10-21: rss, active, ~20 items, newest <2h ' || build_tag,
    'saharareporters.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ng,'Sahara Reporters','https://saharareporters.com/','active','en','saharareporters.com','INVESTIGATIVE','sahara-reporters','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://saharareporters.com/rss.xml','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','SaharaReporters Media Inc',ARRAY['independent']::text[],NULL,
    'Founded in 2006 in New York by Nigerian activist-journalist Omoyele Sowore. Diaspora-run investigative outlet specialising in exposing corruption and human rights violations in Nigeria.',
    'Widely read in Nigeria and the diaspora for investigative reports on government misconduct. Known for publishing leaked documents and whistleblower material.',
    'high','Founding by Omoyele Sowore documented in multiple sources; SaharaReporters Media Inc is a registered US entity.',
    '[{"url":"https://en.wikipedia.org/wiki/Sahara_Reporters","note":"Founded 2006 by Omoyele Sowore, New York-based","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- SN-1: Rewmi
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Rewmi','https://www.rewmi.com/','https://www.rewmi.com/feed/','rss',v_sn,'fr',true,
    'Feed checked 2026-10-21: rss, active, ~20 items, newest same-day ' || build_tag,
    'rewmi.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_sn,'Rewmi','https://www.rewmi.com/','active','fr','rewmi.com','ONLINE_NEWS','rewmi','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.rewmi.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Senegalese online news portal covering politics, society, sport, religion and entertainment.',
    'Active Senegalese digital news outlet with regular updates across national topics.',
    'medium','Ownership structure not publicly documented; editorial character inferred from published content.',
    '[{"url":"https://www.rewmi.com/","note":"Senegalese news portal, content reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- ================================================================
  -- SN-2: Xibaaru
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Xibaaru','https://xibaaru.sn/','https://xibaaru.sn/feed/','rss',v_sn,'fr',true,
    'Feed checked 2026-10-21: rss, active, hourly updates, newest same-day ' || build_tag,
    'xibaaru.sn','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_sn,'Xibaaru','https://xibaaru.sn/','active','fr','xibaaru.sn','ONLINE_NEWS','xibaaru','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://xibaaru.sn/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Senegalese online news portal self-described as covering Senegalese and international news.',
    'Active hourly-updating Senegalese news site with political and general news coverage.',
    'low','Minimal public documentation of ownership; content reviewed and found to be legitimate news coverage.',
    '[{"url":"https://xibaaru.sn/","note":"Self-described Senegalese news portal, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  RAISE NOTICE 'West Africa batch 1: 5 publishers added across GH NG SN';
END $do$;

SELECT 'added|' || count(*) || ' publishers tagged'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #120 West Africa batch 1]%';
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #120 West Africa batch 1]%';