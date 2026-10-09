-- Approve the 10 still-pending shortlist submissions exactly like
-- POST /api/admin/submissions/:id/approve (apps/api/src/admin.js): publisher
-- (feed_status active) + feed + submission approved. Owner request
-- 2026-10-09: NAN Hausa and Aminiya -> Hausa (ha), Actusen -> French (fr).
-- Also: clean names for 3 whose name was the page title; publisher type from
-- the discovery check instead of the default OTHER (only where still OTHER);
-- the 20 shortlist candidates -> 'registered'. One guarded transaction.
\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM publisher_submissions WHERE id IN (49,55,58,59,60,66,74,132,133,134) FOR UPDATE;
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM publisher_submissions s
  WHERE s.id IN (49,55,58,59,60,66,74,132,133,134)
    AND (s.status <> 'pending' OR NOT s.feed_verified OR s.feed_url IS NULL
         OR EXISTS (SELECT 1 FROM feeds f WHERE f.feed_url = s.feed_url)
         OR EXISTS (SELECT 1 FROM publishers p WHERE lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1))
                    = lower(regexp_replace(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', ''), '/.*$', ''))));
  IF bad > 0 OR (SELECT count(*) FROM publisher_submissions WHERE id IN (49,55,58,59,60,66,74,132,133,134)) <> 10 THEN
    RAISE EXCEPTION '% of the 10 submissions are no longer approvable (already approved, or publisher/feed exists) - nothing changed', bad;
  END IF;
END $$;

UPDATE publisher_submissions SET language = 'ha' WHERE id = 49;
UPDATE publisher_submissions SET language = 'fr' WHERE id = 55;
UPDATE publisher_submissions SET name = 'Rádio Morabeza' WHERE id = 74;
UPDATE publisher_submissions SET name = 'Trust TV' WHERE id = 132;
UPDATE publisher_submissions SET name = 'Hespress Français' WHERE id = 134;

DO $$
DECLARE s record; pid int;
BEGIN
  FOR s IN SELECT * FROM publisher_submissions WHERE id IN (49,55,58,59,60,66,74,132,133,134) ORDER BY id LOOP
    INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, logo_url,
      youtube_url, facebook_url, instagram_url, tiktok_url, x_url, region, city, description, contact_email)
    VALUES (s.country_id, s.name, s.homepage_url, 'active', s.language,
      regexp_replace(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', ''), '/.*$', ''),
      s.logo_url, s.youtube_url, s.facebook_url, s.instagram_url, s.tiktok_url, s.x_url, s.region, s.city, s.description, s.contact_email)
    ON CONFLICT (country_id, name) DO UPDATE SET homepage_url = EXCLUDED.homepage_url
    RETURNING id INTO pid;
    INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES (pid, s.feed_url, s.feed_type) ON CONFLICT (feed_url) DO NOTHING;
    UPDATE publisher_submissions SET status = 'approved', reviewed_at = now(), status_changed_at = now(), publisher_id = pid WHERE id = s.id;
  END LOOP;
END $$;

-- Aminiya was already approved (by the owner) with the page's declared language.
UPDATE publishers p SET language = 'ha' FROM publisher_submissions s WHERE s.id = 39 AND p.id = s.publisher_id AND p.language <> 'ha';
UPDATE publisher_submissions SET language = 'ha' WHERE id = 39;

-- Publisher type from the discovery check, for all 20 shortlist publishers still at the default.
UPDATE publishers p SET source_type = d.source_type
FROM discovered_sources d JOIN publisher_submissions s ON s.id = d.promoted_submission_id
WHERE d.id IN (217,171,243,15,257,196,4,280,3,218,296,206,172,240,48,36,169,311,321,178)
  AND p.id = s.publisher_id AND p.source_type = 'OTHER' AND d.source_type IS NOT NULL;

UPDATE discovered_sources SET status = 'registered',
  notes = concat_ws(E'\n', notes, 'approved as publisher 2026-10-09'), updated_at = now()
WHERE id IN (217,171,243,15,257,196,4,280,3,218,296,206,172,240,48,36,169,311,321,178) AND status = 'verified';

SELECT s.id, s.status, p.id AS publisher_id, p.name, p.language, p.source_type, p.feed_status, f.feed_type
FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
LEFT JOIN feeds f ON f.publisher_id = p.id
WHERE s.id IN (39,49,55,58,59,60,66,74,132,133,134) ORDER BY s.id;
COMMIT;
