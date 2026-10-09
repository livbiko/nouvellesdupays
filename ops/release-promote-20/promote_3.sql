-- Promote discovered_sources 48, 169, 321 exactly like POST /api/admin/discovered-sources/:id/promote
-- (apps/api/src/discovery.js): one pending publisher_submissions row each, candidate -> verified.
-- 169 (Trust TV) gets language 'en' first (none detected). Owner request 2026-10-09. One transaction.
\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM discovered_sources WHERE id IN (48, 169, 321) FOR UPDATE;
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM discovered_sources d
  WHERE d.id IN (48, 169, 321)
    AND (d.status NOT IN ('discovered', 'under_review') OR d.health <> 'ok' OR d.feed_url IS NULL OR d.country_id IS NULL
         OR EXISTS (SELECT 1 FROM publishers p WHERE lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1)) = d.domain)
         OR EXISTS (SELECT 1 FROM publisher_submissions s WHERE lower(split_part(regexp_replace(coalesce(s.domain, ''), '^www\.', ''), '/', 1)) = d.domain));
  IF bad > 0 OR (SELECT count(*) FROM discovered_sources WHERE id IN (48, 169, 321)) <> 3 THEN
    RAISE EXCEPTION '% of the 3 rows are no longer promotable (already promoted, publisher or submission exists) - nothing changed', bad;
  END IF;
END $$;
UPDATE discovered_sources SET language = 'en', updated_at = now() WHERE id = 169 AND language IS NULL;
WITH c AS (
  SELECT * FROM discovered_sources WHERE id IN (48, 169, 321)
), ins AS (
  INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
    verification_detail, domain, description, youtube_url, facebook_url, x_url, instagram_url, tiktok_url,
    sitemap_url, ingestion_method, status, status_changed_at)
  SELECT c.name, c.homepage_url, c.feed_url, CASE WHEN c.feed_type = 'sitemap-news' THEN 'sitemap-news' ELSE 'rss' END,
    c.country_id, coalesce(c.language, c.html_lang), true,
    'Discovery worker: ' || c.feed_type || ' feed ' || c.feed_url || ', ' || coalesce(c.item_count::text, '?') || ' items, score '
      || coalesce(c.score::text, 'n/a') || ', found via ' || coalesce(c.discovery_method, '?')
      || coalesce(' (' || c.discovered_from || ')', '') || ' [promoted by Claude on owner request 2026-10-09]',
    c.domain, c.description, c.youtube_url, c.facebook_url, c.x_url, c.instagram_url, c.tiktok_url,
    c.sitemap_url, 'feed', 'pending', now()
  FROM c
  RETURNING id, domain
)
UPDATE discovered_sources d SET status = 'verified', promoted_submission_id = ins.id, updated_at = now()
FROM ins WHERE ins.domain = d.domain AND d.id IN (48, 169, 321);
SELECT d.id, d.domain, d.status, s.id AS submission_id, s.status AS submission_status, s.language
FROM discovered_sources d JOIN publisher_submissions s ON s.id = d.promoted_submission_id WHERE d.id IN (48, 169, 321) ORDER BY d.id;
COMMIT;
