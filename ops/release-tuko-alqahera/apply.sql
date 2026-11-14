-- Build #251 (MEDIUM, owner: "approve Build #251"): 2 publishers from the Group B review (11-14) - their YouTube channels
-- are creator candidates (Tuko 47, AlQahera News 87); their websites become sources. Same shape as Build #134.
-- Checked 11-14 with the bot UA: robots.txt allows both; Tuko RSS 30 items dated today (+0300); AlQahera Google News
-- sitemap 300 items 11-11..11-14 (UTC, Arabic). Ownership not verified for these profiles (review_required).
-- Reverse: reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  IF EXISTS (SELECT 1 FROM publishers WHERE slug IN ('tuko', 'alqahera-news') OR domain IN ('tuko.co.ke', 'alqaheranews.net'))
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url IN ('https://www.tuko.co.ke/rss/all.rss', 'https://alqaheranews.net/sitemaps/news.xml')) THEN
    RAISE EXCEPTION 'One of these is already present - nothing changed';
  END IF;
  -- KE: Tuko
  SELECT id INTO v_cid FROM countries WHERE iso_code = 'KE';
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ('Tuko', 'https://www.tuko.co.ke/', 'https://www.tuko.co.ke/rss/all.rss', 'rss', v_cid, 'en', true,
    'Added on owner approval 2026-11-14 (Group B review: YouTube channel is creator candidate 47); RSS 30 items, newest 2026-11-14 [added by Claude 2026-11-14, Build #251]', 'tuko.co.ke', 'feed', 'approved', now(), now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind, description, youtube_url)
  VALUES (v_cid, 'Tuko', 'https://www.tuko.co.ke/', 'active', 'en', 'tuko.co.ke', 'ONLINE_NEWS', 'tuko', 'organisation', 'Kenyan online news site (English).', NULL)
  RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, 'https://www.tuko.co.ke/rss/all.rss', 'rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, 'Site d''information privé', 'Non vérifié', ARRAY['commercial_generalist']::text[], NULL,
    'Site d''information kényan en anglais.', 'Actualité kényane (politique, société, people, sport) en anglais.', 'low', 'Site privé ; propriété non vérifiée pour ce profil.', '[{"url": "https://www.tuko.co.ke/", "note": "Site officiel : Tuko", "category": "self_description", "accessed_at": "2026-11-14"}]'::jsonb,
    '2026-11-14', '2026-11-14', '2026-11-14', true);
  RAISE NOTICE '% added: publisher %', 'Tuko', v_pid;
  -- EG: AlQahera News
  SELECT id INTO v_cid FROM countries WHERE iso_code = 'EG';
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ('AlQahera News', 'https://alqaheranews.net/', 'https://alqaheranews.net/sitemaps/news.xml', 'sitemap-news', v_cid, 'ar', true,
    'Added on owner approval 2026-11-14 (Group B review: YouTube channel is creator candidate 87); Google News sitemap 300 items 2026-11-11..14 [added by Claude 2026-11-14, Build #251]', 'alqaheranews.net', 'feed', 'approved', now(), now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind, description, youtube_url)
  VALUES (v_cid, 'AlQahera News', 'https://alqaheranews.net/', 'active', 'ar', 'alqaheranews.net', 'TV', 'alqahera-news', 'organisation', 'Egyptian 24-hour news channel based in Cairo, launched 2022 (Arabic).', NULL)
  RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, 'https://alqaheranews.net/sitemaps/news.xml', 'sitemap-news');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, 'Chaîne d''information', 'Non vérifié', ARRAY['unknown']::text[], NULL,
    'Chaîne d''information continue égyptienne basée au Caire, lancée le 31 octobre 2022 (selon sa propre présentation).', 'Actualité égyptienne, régionale et internationale en arabe.', 'low', 'Propriété et ligne éditoriale non vérifiées pour ce profil - à documenter avec des sources.', '[{"url": "https://alqaheranews.net/", "note": "Site officiel : AlQahera News", "category": "self_description", "accessed_at": "2026-11-14"}]'::jsonb,
    '2026-11-14', '2026-11-14', '2026-11-14', true);
  RAISE NOTICE '% added: publisher %', 'AlQahera News', v_pid;
END $do$;
SELECT p.id, p.slug, p.feed_status, f.id AS feed_id, f.feed_type, f.feed_url FROM publishers p JOIN feeds f ON f.publisher_id = p.id
 WHERE p.slug IN ('tuko', 'alqahera-news') ORDER BY p.id;
COMMIT;
