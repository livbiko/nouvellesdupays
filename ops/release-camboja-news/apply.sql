-- Build #131 (MEDIUM): add CamboJA News (Cambodia, KH). Owner approval 2026-11-02: "yes, add CamboJA News".
-- Cambodia had 0 live sources (Khmer Times 403 to our bot, Cambodia Daily HTTP 500). Feed checked 2026-11-02:
-- https://cambojanews.com/feed/ RSS, 11 items, newest 2026-11-02 13:19 UTC, en-GB; robots.txt allows all agents.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
DECLARE v_pid integer; v_sid integer; v_cid integer;
BEGIN
  SELECT id INTO v_cid FROM countries WHERE iso_code = 'KH';
  IF EXISTS (SELECT 1 FROM publishers WHERE slug = 'camboja-news' OR domain = 'cambojanews.com')
     OR EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://cambojanews.com/feed/') THEN
    RAISE EXCEPTION 'CamboJA News already present - nothing changed';
  END IF;
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ('CamboJA News', 'https://cambojanews.com/', 'https://cambojanews.com/feed/', 'rss', v_cid, 'en', true,
    'Added on owner approval 2026-11-02 (Cambodia had no live source); RSS 11 items, newest 2026-11-02 [added by Claude 2026-11-02, CamboJA News]',
    'cambojanews.com', 'feed', 'approved', now(), now()) RETURNING id INTO v_sid;
  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind, description)
  VALUES (v_cid, 'CamboJA News', 'https://cambojanews.com/', 'active', 'en', 'cambojanews.com', 'ONLINE_NEWS', 'camboja-news', 'organisation',
    'English-language news site of the Cambodian Journalists Alliance Association (CamboJA), Phnom Penh.')
  RETURNING id INTO v_pid;
  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, 'https://cambojanews.com/feed/', 'rss');
  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;
  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
    historical_context, current_context, confidence, evidence_summary, evidence_sources,
    classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid, 'Association de journalistes (organisation de la société civile)', 'Cambodian Journalists Alliance Association (CamboJA)',
    ARRAY['independent']::text[], NULL,
    'Site d''information de l''Association de l''alliance des journalistes cambodgiens (CamboJA), basée à Phnom Penh.',
    'Actualité nationale cambodgienne en anglais : enquêtes, reportages spéciaux, résumé hebdomadaire.',
    'medium',
    'Le site s''identifie comme publié par la Cambodian Journalists Alliance Association et se présente comme une source d''information « indépendante » ; financement et gouvernance non vérifiés pour ce profil.',
    '[{"url":"https://cambojanews.com/about/","note":"Mentions éditeur : Cambodian Journalists Alliance Association","category":"self_description","accessed_at":"2026-11-02"},{"url":"https://www.camboja.net/","note":"Site de l''association CamboJA","category":"self_description","accessed_at":"2026-11-02"}]'::jsonb,
    '2026-11-02', '2026-11-02', '2026-11-02', true);
  RAISE NOTICE 'CamboJA News added: publisher %, submission %', v_pid, v_sid;
END $do$;
SELECT p.id, p.slug, c.iso_code, f.id AS feed_id, f.feed_url FROM publishers p JOIN countries c ON c.id=p.country_id JOIN feeds f ON f.publisher_id=p.id WHERE p.slug='camboja-news';
COMMIT;
