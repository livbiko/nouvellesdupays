-- Read-only: runs the exact SQL of branch feature/coverage-first-discovery against production data.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
\timing on

-- 1. mine() order: the first 12 homepages the worker would mine now (all Africa, target 5, 7 days)
WITH cov AS (
  SELECT p.country_id,
         count(*)::int AS active,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM articles a
            WHERE a.publisher_id = p.id
              AND a.published_at >= now()::timestamptz - make_interval(days => 7)
              AND a.published_at <  now()::timestamptz + interval '1 day'))::int AS healthy
    FROM publishers p
   WHERE p.feed_status = 'active'
   GROUP BY p.country_id)
SELECT 'mine|' || p.id || '|' || c.iso_code || '|healthy=' || coalesce(cov.healthy, 0) || '/' || coalesce(cov.active, 0)
       || '|mined=' || coalesce(to_char(m.mined_at, 'YYYY-MM-DD'), 'never') || '|' || p.homepage_url
  FROM publishers p
  JOIN countries c ON c.id = p.country_id
  LEFT JOIN cov ON cov.country_id = c.id
  LEFT JOIN discovery_mining_log m ON m.publisher_id = p.id
 WHERE c.region = ANY(ARRAY['West Africa','East Africa','Central Africa','North Africa','Southern Africa']) AND p.feed_status = 'active'
   AND (m.mined_at IS NULL OR m.mined_at < now() - interval '14 days')
 ORDER BY CASE WHEN coalesce(cov.healthy, 0) = 0 THEN 0 WHEN cov.healthy < 5 THEN 1 ELSE 2 END,
          coalesce(cov.healthy, 0), m.mined_at NULLS FIRST, p.id
 LIMIT 12;

-- 2. Coverage of every country with active publishers, worst first (status per shared/src/coverage.js)
WITH cov AS (
  SELECT p.country_id, count(*)::int AS active,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM articles a WHERE a.publisher_id = p.id
              AND a.published_at >= now() - interval '7 days' AND a.published_at < now() + interval '1 day'))::int AS healthy
    FROM publishers p WHERE p.feed_status = 'active' GROUP BY p.country_id)
SELECT 'cov|' || c.region || '|' || c.iso_code || '|' || cov.healthy || '/' || cov.active || '|'
       || CASE WHEN cov.healthy = 0 THEN 'stale' WHEN cov.healthy < 5 THEN 'low' ELSE 'healthy' END
  FROM cov JOIN countries c ON c.id = cov.country_id
 ORDER BY CASE WHEN cov.healthy = 0 THEN 0 WHEN cov.healthy < 5 THEN 1 ELSE 2 END, c.region, cov.healthy, c.iso_code;

-- 3. Countries in the registry with no active publisher at all ('none')
SELECT 'none|' || coalesce(c.region, '-') || '|' || c.iso_code || '|' || c.name
  FROM countries c
 WHERE NOT EXISTS (SELECT 1 FROM publishers p WHERE p.country_id = c.id AND p.feed_status = 'active')
 ORDER BY c.region, c.iso_code;
