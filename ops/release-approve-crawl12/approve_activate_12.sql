-- Approve + activate the 12 crawled (feed-less) submissions, owner request 2026-10-10.
-- Mirrors POST /api/admin/submissions/:id/approve (no-feed branch: publisher + crawl source
-- [sitemap if known, else homepage], allowed_domains = own domain, robots.txt respected,
-- crawler_default_frequency_minutes = 60 - no app_settings override) followed by
-- POST /api/admin/submissions/:id/activate (publisher active, submission active).
-- Also: 4 names cleaned, publisher type from the discovery check, candidates -> registered.
-- Guarded against snapshot-before.txt; one transaction.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE todo (sub int, new_name text) ON COMMIT DROP;
INSERT INTO todo VALUES (70, 'Trust Radio'), (76, NULL), (78, NULL), (79, NULL), (80, 'Inforpress'), (81, NULL),
  (86, NULL), (87, NULL), (89, 'L''Essor'), (91, NULL), (92, NULL), (94, 'Conakry Live');
SELECT id FROM publisher_submissions WHERE id IN (SELECT sub FROM todo) FOR UPDATE;
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM todo LEFT JOIN publisher_submissions s ON s.id = todo.sub
  WHERE s.status IS DISTINCT FROM 'submitted' OR s.publisher_id IS NOT NULL OR s.feed_url IS NOT NULL
     OR s.ingestion_method NOT IN ('sitemap', 'html');
  IF bad > 0 THEN RAISE EXCEPTION '% submissions changed since the snapshot - nothing changed', bad; END IF;
  SELECT count(*) INTO bad FROM todo JOIN publisher_submissions s ON s.id = todo.sub
  WHERE EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = s.country_id AND lower(p.name) = lower(coalesce(todo.new_name, trim(s.name))))
     OR EXISTS (SELECT 1 FROM publishers p WHERE lower(regexp_replace(regexp_replace(p.domain, '^www\.', ''), '/+$', ''))
                = split_part(lower(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', '')), '/', 1))
     OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = coalesce(s.sitemap_url, s.homepage_url));
  IF bad > 0 THEN RAISE EXCEPTION '% submissions now duplicate an existing publisher/feed - nothing changed', bad; END IF;
END $$;

UPDATE publisher_submissions s SET name = todo.new_name FROM todo WHERE todo.sub = s.id AND todo.new_name IS NOT NULL;

DO $$
DECLARE s record; pid int;
BEGIN
  FOR s IN SELECT * FROM publisher_submissions WHERE id IN (SELECT sub FROM todo) ORDER BY id LOOP
    -- approve (no-feed branch)
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, logo_url,
      youtube_url, facebook_url, instagram_url, tiktok_url, x_url, region, city, description, contact_email)
    VALUES (s.country_id, s.name, s.homepage_url, 'pending', s.language,
      regexp_replace(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', ''), '/.*$', ''),
      s.logo_url, s.youtube_url, s.facebook_url, s.instagram_url, s.tiktok_url, s.x_url, s.region, s.city, s.description, s.contact_email)
    RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, allowed_domains,
      category_urls, article_url_patterns, respect_robots_txt, enabled)
    VALUES (pid, coalesce(s.sitemap_url, s.homepage_url), CASE WHEN s.sitemap_url IS NOT NULL THEN 'sitemap' ELSE 'html' END, 60,
      ARRAY[lower(regexp_replace(split_part(regexp_replace(s.homepage_url, '^https?://', ''), '/', 1), '^www\.', ''))],
      coalesce(s.category_urls, '{}'), coalesce(s.article_url_patterns, '{}'), true, true);
    UPDATE publisher_submissions SET status = 'approved', reviewed_at = now(), status_changed_at = now(), publisher_id = pid WHERE id = s.id;
    -- activate
    UPDATE publishers SET feed_status = 'active' WHERE id = pid;
    UPDATE publisher_submissions SET status = 'active', status_changed_at = now() WHERE id = s.id;
  END LOOP;
END $$;

UPDATE publishers p SET source_type = d.source_type
FROM publisher_submissions s JOIN discovered_sources d ON d.promoted_submission_id = s.id
WHERE s.id IN (SELECT sub FROM todo) AND p.id = s.publisher_id AND p.source_type = 'OTHER' AND d.source_type IS NOT NULL;
UPDATE discovered_sources d SET status = 'registered', updated_at = now(),
  notes = concat_ws(E'\n', d.notes, 'approved as crawled publisher 2026-10-10')
FROM publisher_submissions s WHERE s.id IN (SELECT sub FROM todo) AND d.promoted_submission_id = s.id AND d.status = 'verified';

SELECT s.id, s.status, p.id, p.name, p.feed_status, p.source_type, f.feed_type, f.feed_url, f.allowed_domains
FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
WHERE s.id IN (SELECT sub FROM todo) ORDER BY s.id;
COMMIT;
