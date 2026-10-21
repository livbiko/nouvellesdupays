-- Rehearsal (ROLLBACK) for Build #124 North Africa batch 1.
-- 4 publishers: MA(+1) TN(+2) SD(+1)
-- Already in DB (africa-voices): hespress(MA,165), tsa-algerie(DZ,168), libya-herald(LY,178)
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;

DO $do$
DECLARE
  v_ma  integer; v_tn  integer; v_sd  integer;
  v_pid integer; v_sid integer;
  build_tag constant text := '[added by Claude 2026-10-21, Build #124 North Africa batch 1]';
  bad integer;
BEGIN
  SELECT id INTO STRICT v_ma FROM countries WHERE iso_code = 'MA';
  SELECT id INTO STRICT v_tn FROM countries WHERE iso_code = 'TN';
  SELECT id INTO STRICT v_sd FROM countries WHERE iso_code = 'SD';

  SELECT count(*) INTO bad FROM publishers WHERE slug IN (
    'lavieeco','businessnews-tn','nawaat','sudan-tribune'
  );
  IF bad > 0 THEN RAISE EXCEPTION 'One or more publishers already exist (% slugs found) — nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM publisher_submissions WHERE verification_detail LIKE '%' || build_tag || '%';
  IF bad > 0 THEN RAISE EXCEPTION 'Build already applied — nothing changed'; END IF;
  SELECT count(*) INTO bad FROM publishers p
  WHERE (p.country_id = v_ma AND p.domain IN ('lavieeco.com'))
     OR (p.country_id = v_tn AND p.domain IN ('businessnews.com.tn','nawaat.org'))
     OR (p.country_id = v_sd AND p.domain IN ('sudantribune.net'));
  IF bad > 0 THEN RAISE EXCEPTION '% domain+country pair(s) already exist', bad; END IF;

  -- MA-1: La Vie Éco
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('La Vie Éco','https://lavieeco.com/','https://lavieeco.com/feed/','rss',v_ma,'fr',true,
    'Feed checked 2026-10-21: rss, active, 25 items, newest same-day ' || build_tag,
    'lavieeco.com','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_ma,'La Vie Éco','https://lavieeco.com/','active','fr','lavieeco.com','ONLINE_NEWS','lavieeco','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://lavieeco.com/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Moroccan French-language weekly and digital news outlet covering economics, business, politics and society.',
    'Active digital presence with continuous updates on Moroccan economic and political affairs.',
    'medium','Content reviewed 2026-10-21; ownership not publicly verified.',
    '[{"url":"https://lavieeco.com/","note":"Moroccan French-language news outlet, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- TN-1: BusinessNews Tunisie
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('BusinessNews Tunisie','https://www.businessnews.com.tn/','https://www.businessnews.com.tn/feed/','rss',v_tn,'fr',true,
    'Feed checked 2026-10-21: rss, active, regular updates, newest same-day ' || build_tag,
    'businessnews.com.tn','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_tn,'BusinessNews Tunisie','https://www.businessnews.com.tn/','active','fr','businessnews.com.tn','ONLINE_NEWS','businessnews-tn','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://www.businessnews.com.tn/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['commercial_generalist']::text[],NULL,
    'Tunisian French-language digital news portal covering business, economy and general affairs.',
    'Active news site with continuous updates on Tunisian business and political news.',
    'medium','Content reviewed 2026-10-21; ownership not publicly verified.',
    '[{"url":"https://www.businessnews.com.tn/","note":"Tunisian French-language news, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  -- TN-2: Nawaat
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Nawaat','https://nawaat.org/','https://nawaat.org/feed/','rss',v_tn,'fr',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest Oct 20 2026 ' || build_tag,
    'nawaat.org','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_tn,'Nawaat','https://nawaat.org/','active','fr','nawaat.org','INVESTIGATIVE','nawaat','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://nawaat.org/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'non_profit','Nawaat collective',ARRAY['independent']::text[],NULL,
    'Founded in 2004 as a Tunisian blog collective; documented role in 2010–2011 Arab Spring.',
    'One of North Africa''s leading independent investigative outlets.',
    'high','Role in Arab Spring documented by CPJ, RSF and academic sources.',
    '[{"url":"https://en.wikipedia.org/wiki/Nawaat","note":"Founded 2004; independent Tunisian investigative outlet","category":"reference","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',false);

  -- SD-1: Sudan Tribune
  INSERT INTO publisher_submissions (name,homepage_url,feed_url,feed_type,country_id,language,
    feed_verified,verification_detail,domain,ingestion_method,status,status_changed_at,reviewed_at)
  VALUES ('Sudan Tribune','https://sudantribune.net/','https://sudantribune.net/feed/','rss',v_sd,'ar',true,
    'Feed checked 2026-10-21: rss, active, 10 items, newest Oct 20 2026 ' || build_tag,
    'sudantribune.net','feed','approved',now(),now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id,name,homepage_url,feed_status,language,domain,source_type,slug,creator_kind)
  VALUES (v_sd,'Sudan Tribune','https://sudantribune.net/','active','ar','sudantribune.net','NEWSPAPER','sudan-tribune','organisation') RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id,feed_url,feed_type) VALUES (v_pid,'https://sudantribune.net/feed/','rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id,ownership_type,owner,classification_tags,
    political_party_association,historical_context,current_context,
    confidence,evidence_summary,evidence_sources,classification_date,last_reviewed,evidence_date,review_required)
  VALUES (v_pid,'commercial','unknown',ARRAY['independent']::text[],NULL,
    'Arabic-language news service covering Sudanese politics, conflict, humanitarian affairs and society.',
    'Active independent outlet reporting on the Sudan conflict. One of the few continuously operating independent Sudanese news sources.',
    'medium','Editorial character confirmed by content review 2026-10-21; ownership not fully public.',
    '[{"url":"https://sudantribune.net/","note":"Arabic-language Sudanese independent news, reviewed 2026-10-21","category":"primary","accessed_at":"2026-10-21"}]'::jsonb,
    '2026-10-21','2026-10-21','2026-10-21',true);

  RAISE NOTICE 'North Africa batch 1: 4 publishers added across MA TN SD';
END $do$;

SELECT 'added|' || count(*) || ' publishers tagged'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #124 North Africa batch 1]%';
ROLLBACK;
SELECT 'rolledback|' || count(*) || ' tagged submissions left'
  FROM publisher_submissions
  WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #124 North Africa batch 1]%';
