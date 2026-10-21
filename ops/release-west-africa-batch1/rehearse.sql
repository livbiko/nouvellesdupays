-- Build #120 West Africa Batch 1 (data only, MEDIUM). Reverse: reverse.sql.
-- 10 publishers: CI(+2) GH(+2) NG(+3) SN(+2) BF(+1)
-- Already in DB: myjoyonline, guineematin, guineenews, sierra-leone-telegraph
-- All feeds verified 2026-10-21.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_ci  integer; v_gh  integer; v_ng  integer; v_sn  integer; v_bf  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #120 West Africa batch 1]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_ci FROM countries WHERE iso_code = 'CI';
  SELECT id INTO STRICT v_gh FROM countries WHERE iso_code = 'GH';
  SELECT id INTO STRICT v_ng FROM countries WHERE iso_code = 'NG';
  SELECT id INTO STRICT v_sn FROM countries WHERE iso_code = 'SN';
  SELECT id INTO STRICT v_bf FROM countries WHERE iso_code = 'BF';

  -- Idempotency: fail if any slug already exists or build already applied
  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'aip-ci','connectionivoirienne','adom-online','3news-ghana',
    'premium-times-nigeria','tribune-online-nigeria','sahara-reporters',
    'rewmi','xibaaru','lefaso'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;

  -- ================================================================
  -- CI-1: AIP (Agence Ivoirienne de Presse)
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('AIP','https://www.aip.ci/','https://www.aip.ci/feed/','rss',v_ci,'fr',true,
    'Feed checked 2026-10-21: rss, active, ~20 items, newest same-day ' || build_tag,
    'aip.ci','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ci,'AIP','https://www.aip.ci/','active','fr','aip.ci','NEWS_AGENCY','aip-ci','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.aip.ci/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'government','État de Côte d''Ivoire',ARRAY['government_news_agency']::text[],NULL,
    'National news agency of Côte d''Ivoire, established in 1961. Government-owned and operated. Provides official state coverage of national politics, economy and social affairs.',
    'Official state news wire distributed to Ivorian media and international outlets. Principal source of government-attributed statements and official event coverage.',
    'high','Government ownership documented in official records and widely acknowledged in African media directories.',
    '[{"url":"https://www.aip.ci/","note":"Official AIP website, government imprint visible","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- CI-2: Connectionivoirienne
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Connectionivoirienne','https://www.connectionivoirienne.net/','https://www.connectionivoirienne.net/feed/','rss',v_ci,'fr',true,
    'Feed checked 2026-10-21: rss, active, hourly updates, newest same-day ' || build_tag,
    'connectionivoirienne.net','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ci,'Connectionivoirienne','https://www.connectionivoirienne.net/','active','fr','connectionivoirienne.net','ONLINE_NEWS','connectionivoirienne','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.connectionivoirienne.net/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['independent','online_only']::text[],NULL,
    'Independent Ivorian news and information website founded in 2007. Covers politics, economy, sports and society from Côte d''Ivoire.',
    'One of the established independent online news platforms in Côte d''Ivoire, publishing hourly updates.',
    'medium','Site self-describes as independent; founding date and ownership structure not fully documented.',
    '[{"url":"https://www.connectionivoirienne.net/","note":"Site founded 2007 per homepage","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

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
  -- GH-2: 3News
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('3News','https://3news.com/','https://3news.com/feed/','rss',v_gh,'en',true,
    'Feed checked 2026-10-21: rss, active, ~25 items, newest <2h ' || build_tag,
    '3news.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_gh,'3News','https://3news.com/','active','en','3news.com','ONLINE_NEWS','3news-ghana','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://3news.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','EIB Network',ARRAY['commercial_generalist']::text[],NULL,
    'Online news portal of the EIB (Excellence in Broadcasting) Network, a major Ghanaian private media group owning TV3, EIB FM, Asempa FM, Starr FM and Capital FM.',
    'Provides continuous national news coverage across politics, business, sports and entertainment for a broad Ghanaian audience.',
    'medium','EIB Network ownership inferred from site branding and TV3/3News relationship; fully documented on their corporate pages.',
    '[{"url":"https://3news.com/","note":"TV3/EIB Network branding on-site","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- NG-1: Premium Times Nigeria
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Premium Times Nigeria','https://www.premiumtimesng.com/','https://premiumtimesng.com/feed/','rss',v_ng,'en',true,
    'Feed checked 2026-10-21: rss, active, ~25 items, newest <1h ' || build_tag,
    'premiumtimesng.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ng,'Premium Times Nigeria','https://www.premiumtimesng.com/','active','en','premiumtimesng.com','INVESTIGATIVE','premium-times-nigeria','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://premiumtimesng.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','Premium Times Services Ltd',ARRAY['independent','investigative']::text[],NULL,
    'Nigeria''s leading independent investigative newspaper, founded in 2011. Known for exposing government corruption and human rights abuses. Partner of the ICIJ (Panama Papers, FinCEN Files).',
    'One of Nigeria''s most-trusted digital news outlets. Strong investigative journalism track record. Editorially independent of government and major business interests.',
    'high','Premium Times Services Ltd is a registered Nigerian company; ICIJ partnership and investigative record are well-documented.',
    '[{"url":"https://en.wikipedia.org/wiki/Premium_Times_(Nigeria)","note":"Founded 2011, independent investigative, ICIJ partner","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- NG-2: Tribune Online (Nigerian Tribune)
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
    'Digital portal of Nigerian Tribune, Nigeria''s oldest surviving private newspaper, founded in 1949 by Chief Obafemi Awolowo in Ibadan. Published by African Newspapers of Nigeria Plc.',
    'One of Nigeria''s most established news brands. Covers national politics, governance, economy, sports and culture.',
    'high','Nigerian Tribune''s 1949 founding and Awolowo Foundation/African Newspapers of Nigeria Plc ownership are widely documented.',
    '[{"url":"https://en.wikipedia.org/wiki/Nigerian_Tribune","note":"Founded 1949 by Obafemi Awolowo; African Newspapers of Nigeria Plc","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- ================================================================
  -- NG-3: Sahara Reporters
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
  VALUES (v_pid,'commercial','SaharaReporters Media Inc',ARRAY['independent','investigative']::text[],NULL,
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

  -- ================================================================
  -- BF-1: LeFaso.net
  -- ================================================================
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('LeFaso.net','https://lefaso.net/','https://lefaso.net/spip.php?page=backend','rss',v_bf,'fr',true,
    'Feed checked 2026-10-21: rss (SPIP backend), active, ~20 items, newest same-day ' || build_tag,
    'lefaso.net','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_bf,'LeFaso.net','https://lefaso.net/','active','fr','lefaso.net','ONLINE_NEWS','lefaso','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://lefaso.net/spip.php?page=backend','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['independent','commercial_generalist']::text[],NULL,
    'One of Burkina Faso''s oldest and most important online news sites, founded in the early 2000s. An early pioneer of digital journalism in francophone West Africa. Covers politics, economy, culture and sports.',
    'Widely referenced as a leading independent Burkinabè news source. Continues to publish despite political pressures on press freedom in Burkina Faso since 2022.',
    'high','LeFaso.net''s founding and significance are documented in African digital media surveys and journalism studies.',
    '[{"url":"https://lefaso.net/","note":"Pioneer Burkinabè online news site, active since early 2000s, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  RAISE NOTICE 'West Africa batch 1: 10 publishers added across CI GH NG SN BF';
END $do$;

SELECT 'added|' || count(*) || ' publishers tagged'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #120 West Africa batch 1]%';
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #120 West Africa batch 1]%';