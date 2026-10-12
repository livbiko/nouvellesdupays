-- Round-3 follow-ups, owner approval 2026-10-12 ("approve all"). Data only, mirrors the admin endpoints:
-- A. NBC Namibia: publisher 270 moves to nbcnews.na (PATCH /publishers/270 homepage_url; domain kept in step so the
--    duplicate check sees the new site), new RSS source https://nbcnews.na/rss.xml (POST /publishers/270/sources),
--    old nbc.na source disabled (PATCH /sources/270 enabled=false; HTTP 403, 2930 failures, 0 articles ever);
--    submission 137 rejected as merged (POST /submissions/137/reject); candidate 382 -> registered.
-- B. Keydmedia: suspended (POST /submissions/161/suspend) - frozen since January 2023 in English and Somali.
-- C. Approve submissions 168-171 (POST /submissions/:id/approve; TNX crawl source configured + /activate).
-- One transaction, guarded; reverse: reverse.sql (generated from before.txt by make-reverse.ps1).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE appr (sub int, kind text, src_url text, src_type text, patterns text[]) ON COMMIT DROP;
INSERT INTO appr VALUES
  (168, 'feed', NULL, NULL, NULL),
  (169, 'feed', NULL, NULL, NULL),
  (170, 'feed', NULL, NULL, NULL),
  (171, 'crawl', 'https://www.tnx.africa/', 'html', ARRAY['/*/article/*']);

SELECT id FROM publishers WHERE id IN (270, 8951) FOR UPDATE;
SELECT id FROM feeds WHERE id IN (270, 8949) FOR UPDATE;
SELECT id FROM publisher_submissions WHERE id IN (137, 161, 168, 169, 170, 171) FOR UPDATE;
SELECT id FROM discovered_sources WHERE id IN (382, 314, 357, 425, 477) FOR UPDATE;

CREATE TEMP TABLE subx ON COMMIT DROP AS
  SELECT s.*, a.kind, a.src_url, a.src_type, a.patterns,
    regexp_replace(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', ''), '/.*$', '') AS pub_domain,
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(s.homepage_url), '^https?://', ''), '^www\.', ''), '[?#].*$', ''), '/+$', '') AS conflict_host,
    lower(regexp_replace(split_part(regexp_replace(s.homepage_url, '^https?://', ''), '/', 1), '^www\.', '')) AS own_domain
  FROM appr a JOIN publisher_submissions s ON s.id = a.sub;

DO $$
DECLARE n int; bad int;
BEGIN
  -- A. NBC
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 270 AND name = 'NBC Namibia' AND domain = 'nbc.na' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 270 changed (not NBC Namibia / nbc.na / active) - nothing changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 270 AND publisher_id = 270 AND feed_url = 'https://www.nbc.na/rss.xml' AND enabled AND last_status LIKE 'error%') THEN
    RAISE EXCEPTION 'feed 270 changed (no longer the failing nbc.na feed) - nothing changed'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 270) <> 1 THEN RAISE EXCEPTION 'publisher 270 has other sources now - nothing changed'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://nbcnews.na/rss.xml')
     OR EXISTS (SELECT 1 FROM publishers WHERE lower(regexp_replace(domain, '^www\.', '')) = 'nbcnews.na') THEN
    RAISE EXCEPTION 'nbcnews.na is already a publisher or source - nothing changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 137 AND status = 'pending' AND publisher_id IS NULL
                 AND feed_url = 'https://nbcnews.na/rss.xml') THEN
    RAISE EXCEPTION 'submission 137 changed - nothing changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM discovered_sources WHERE id = 382 AND status = 'verified' AND promoted_submission_id = 137) THEN
    RAISE EXCEPTION 'candidate 382 changed - nothing changed'; END IF;
  -- B. Keydmedia
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
                 WHERE s.id = 161 AND s.status = 'active' AND p.id = 8951 AND p.feed_status = 'active') THEN
    RAISE EXCEPTION 'Keydmedia (161 / 8951) is no longer active - nothing changed'; END IF;
  -- C. 168-171
  SELECT count(*) INTO n FROM subx;
  IF n <> 4 THEN RAISE EXCEPTION 'found % of the 4 submissions', n; END IF;
  SELECT count(*) INTO bad FROM subx s
  WHERE s.status <> CASE WHEN s.kind = 'feed' THEN 'pending' ELSE 'submitted' END
     OR s.publisher_id IS NOT NULL OR (s.feed_url IS NOT NULL) <> (s.kind = 'feed') OR (s.kind = 'feed' AND NOT s.feed_verified)
     OR s.verification_detail NOT LIKE '%[promoted by Claude on owner request 2026-10-12]'
     OR NOT EXISTS (SELECT 1 FROM discovered_sources d WHERE d.promoted_submission_id = s.id AND d.status = 'verified');
  IF bad > 0 THEN RAISE EXCEPTION '% of 4 submissions changed since they were promoted - nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM subx s
  WHERE EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = s.country_id AND lower(p.name) = lower(trim(s.name)))
     OR EXISTS (SELECT 1 FROM publishers p WHERE lower(regexp_replace(regexp_replace(p.domain, '^www\.', ''), '/+$', '')) = s.conflict_host)
     OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = coalesce(s.feed_url, s.src_url, s.sitemap_url, s.homepage_url));
  IF bad > 0 THEN RAISE EXCEPTION '% of 4 now duplicate an existing publisher or feed - nothing changed', bad; END IF;
END $$;

-- A. NBC Namibia
UPDATE publishers SET homepage_url = 'https://nbcnews.na/', domain = 'nbcnews.na' WHERE id = 270;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
  allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (270, 'https://nbcnews.na/rss.xml', 'rss', NULL, true, true, '{}', '{}', '{}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 270;
UPDATE publisher_submissions SET status = 'rejected', reviewed_at = now(), status_changed_at = now(),
  reviewer_note = 'Merged 2026-10-12 into existing publisher 270 "NBC Namibia", which now uses this site and feed.'
WHERE id = 137;
UPDATE discovered_sources SET status = 'registered', updated_at = now(),
  notes = concat_ws(E'\n', notes, 'merged into publisher 270 (NBC Namibia) 2026-10-12')
WHERE id = 382;

-- B. Keydmedia
UPDATE publisher_submissions SET status = 'suspended', status_changed_at = now(),
  reviewer_note = 'Suspended 2026-10-12: site frozen since January 2023 in English and Somali (newest stories 7 January 2023). Reactivate if it resumes.'
WHERE id = 161;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 8951;

-- C. Approve 168-171 (+ activate TNX)
DO $$
DECLARE s record; pid int; freq int;
BEGIN
  freq := coalesce((SELECT nullif(regexp_replace(value::text, '[^0-9]', '', 'g'), '')::int FROM app_settings
                    WHERE key = 'crawler_default_frequency_minutes'), 60);
  FOR s IN SELECT * FROM subx ORDER BY id LOOP
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, logo_url,
      youtube_url, facebook_url, instagram_url, tiktok_url, x_url, region, city, description, contact_email)
    VALUES (s.country_id, s.name, s.homepage_url, CASE WHEN s.kind = 'feed' THEN 'active' ELSE 'pending' END, s.language, s.pub_domain,
      s.logo_url, s.youtube_url, s.facebook_url, s.instagram_url, s.tiktok_url, s.x_url, s.region, s.city, s.description, s.contact_email)
    RETURNING id INTO pid;
    IF s.kind = 'feed' THEN
      INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed_url, s.feed_type);
    ELSE
      INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, allowed_domains,
        category_urls, article_url_patterns, respect_robots_txt, enabled)
      VALUES (pid, s.src_url, s.src_type, freq, ARRAY[s.own_domain], coalesce(s.category_urls, '{}'), s.patterns, true, true);
    END IF;
    UPDATE publisher_submissions SET status = 'approved', reviewed_at = now(), status_changed_at = now(), publisher_id = pid WHERE id = s.id;
    IF s.kind = 'crawl' THEN
      UPDATE publishers SET feed_status = 'active' WHERE id = pid;
      UPDATE publisher_submissions SET status = 'active', status_changed_at = now() WHERE id = s.id;
    END IF;
  END LOOP;
END $$;
UPDATE publishers p SET source_type = d.source_type
FROM publisher_submissions s JOIN discovered_sources d ON d.promoted_submission_id = s.id
WHERE s.id IN (SELECT id FROM subx) AND p.id = s.publisher_id AND p.source_type = 'OTHER' AND d.source_type IS NOT NULL;
UPDATE discovered_sources d SET status = 'registered', updated_at = now(),
  notes = concat_ws(E'\n', d.notes, 'approved as publisher 2026-10-12')
WHERE d.promoted_submission_id IN (SELECT id FROM subx) AND d.status = 'verified';

SELECT 'nbc|' || p.id || '|' || p.domain || '|' || p.feed_status || '|' || string_agg(f.feed_url || ' ' || f.enabled, ', ' ORDER BY f.id)
FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 270 GROUP BY p.id;
SELECT 'sub|' || s.id || '|' || s.status || '|' || coalesce(p.id::text, '') || '|' || coalesce(p.feed_status, '') || '|' || coalesce(p.source_type, '')
  || '|' || coalesce(f.feed_type, '') || '|' || coalesce(f.feed_url, '') || '|' || s.name
FROM publisher_submissions s LEFT JOIN publishers p ON p.id = s.publisher_id LEFT JOIN feeds f ON f.publisher_id = p.id AND s.id <> 161
WHERE s.id IN (137, 161, 168, 169, 170, 171) ORDER BY s.id;
COMMIT;
