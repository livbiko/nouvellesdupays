\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'row|' || x.* FROM (SELECT 1) x WHERE false;
WITH last AS (
  SELECT publisher_id, max(fetched_at) AS last_fetch FROM articles
   WHERE fetched_at > now() - interval '120 days' GROUP BY publisher_id),
src AS (
  SELECT DISTINCT ON (publisher_id) publisher_id, consecutive_failures, last_error
    FROM feeds WHERE enabled ORDER BY publisher_id, last_success_at DESC NULLS LAST)
SELECT CASE WHEN coalesce(s.consecutive_failures, 0) > 0 THEN 'failing' ELSE 'silent' END,
       p.id, p.name, c.iso_code,
       coalesce(to_char(l.last_fetch, 'YYYY-MM-DD'), 'none in 120 days'),
       coalesce(left(s.last_error, 50), '')
  FROM publishers p
  JOIN countries c ON c.id = p.country_id
  LEFT JOIN last l ON l.publisher_id = p.id
  LEFT JOIN src s ON s.publisher_id = p.id
 WHERE p.feed_status = 'active'
   AND (l.last_fetch IS NULL OR l.last_fetch < now() - interval '14 days')
 ORDER BY 1 DESC, l.last_fetch DESC NULLS LAST, p.name;

