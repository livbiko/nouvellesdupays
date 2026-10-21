-- Build #119 Africanews (data only, MEDIUM). Reverse: reverse.sql.
-- Feed verified 2026-10-21: https://www.africanews.com/feed/ rss, ~20 items, newest <1h.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
BEGIN;
DO $do$
DECLARE
  v_cid integer; v_sid integer; v_pid integer; bad integer;
BEGIN
  SELECT id INTO STRICT v_cid FROM countries WHERE iso_code = 'CG';

  -- Idempotency guard: fail loudly if already applied or publisher/feed conflict exists
  SELECT count(*) INTO bad
    FROM (SELECT 1 WHERE EXISTS (SELECT 1 FROM publishers WHERE slug = 'africanews')
          UNION ALL SELECT 1 WHERE EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.africanews.com/feed/')
          UNION ALL SELECT 1 WHERE EXISTS (SELECT 1 FROM publisher_submissions
                                           WHERE verification_detail LIKE '%[added by Claude 2026-10-21, Build #119 Africanews]%')) x;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Africanews already exists (publisher, feed, or earlier run) - nothing changed';
  END IF;

  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language,
    feed_verified, verification_detail, domain, ingestion_method, status, status_changed_at, reviewed_at)
  VALUES ('Africanews', 'https://www.africanews.com/', 'https://www.africanews.com/feed/', 'rss', v_cid, 'en', true,
    'Feed checked 2026-10-21: rss, ~20 items, newest <1h [added by Claude 2026-10-21, Build #119 Africanews]',
    'africanews.com', 'feed', 'approved', now(), now())
  RETURNING id INTO v_sid;

  INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, source_type, slug, creator_kind)
  VALUES (v_cid, 'Africanews', 'https://www.africanews.com/', 'active', 'en', 'africanews.com', 'TV', 'africanews', 'newsroom')
  RETURNING id INTO v_pid;

  INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (v_pid, 'https://www.africanews.com/feed/', 'rss');

  UPDATE publisher_submissions SET publisher_id = v_pid WHERE id = v_sid;

  INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags,
    political_party_association, historical_context, current_context,
    confidence, evidence_summary, evidence_sources, classification_date, last_reviewed, evidence_date, review_required)
  VALUES (v_pid,
    'commercial', 'Euronews / Media Globe Networks',
    ARRAY['commercial_generalist']::text[],
    NULL,
    'Pan-African English-language news television channel launched in 2016 by Euronews, headquartered in Pointe-Noire, Republic of Congo. Owned by Euronews through Media Globe Networks, whose shareholders include NBCUniversal, France Télévisions, and RAI.',
    'Broadcasts across Africa via satellite (Canal+, StarTimes, GOtv) and online. One of the leading pan-African English-language TV news channels.',
    'high',
    'Ownership and founding documented by Wikipedia and Euronews corporate communications.',
    '[{"url": "https://en.wikipedia.org/wiki/Africanews", "note": "Launched 2016 by Euronews; Media Globe Networks shareholders; HQ Pointe-Noire CG", "category": "reference", "accessed_at": "2026-10-21"}]'::jsonb,
    DATE '2026-10-21', DATE '2026-10-21', DATE '2026-10-21', false);

  INSERT INTO social_accounts (publisher_id, platform, url, handle, verification, status, discovered_from)
  VALUES (v_pid, 'youtube', 'https://www.youtube.com/@africanews', '@africanews', 'unverified', 'active', 'admin');

  RAISE NOTICE 'Africanews added: publisher_id=%, country=CG', v_pid;
END $do$;
SELECT 'added|' || p.id || '|' || p.slug || '|' || p.feed_status || '|' || f.feed_url || '|profile ' || array_to_string(e.classification_tags, ',')
  FROM publisher_submissions s
  JOIN publishers p ON p.id = s.publisher_id
  JOIN feeds f ON f.publisher_id = p.id
  JOIN editorial_profiles e ON e.publisher_id = p.id
  WHERE s.verification_detail LIKE '%[added by Claude 2026-10-21, Build #119 Africanews]%';
SELECT 'coverage|CG|' || count(*) FILTER (WHERE p.feed_status = 'active') || ' active'
  FROM countries c JOIN publishers p ON p.country_id = c.id WHERE c.iso_code = 'CG';
COMMIT;
