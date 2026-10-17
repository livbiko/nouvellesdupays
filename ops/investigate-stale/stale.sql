-- Read-only: active publishers with no article fetched in 14 days, with their feed state.
\set ON_ERROR_STOP on
SET statement_timeout = '120s';
WITH last AS (SELECT publisher_id, max(fetched_at) AS last_fetch FROM articles WHERE fetched_at > now() - interval '120 days' GROUP BY publisher_id)
SELECT 'stale|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || coalesce(to_char(l.last_fetch, 'YYYY-MM-DD'), 'none<120d') || '|' || to_char(p.created_at, 'YYYY-MM-DD')
       || '|' || coalesce(f.feed_url, 'NO ENABLED FEED') || '|' || coalesce(f.last_status, '-') || '|' || coalesce(to_char(f.last_success_at, 'YYYY-MM-DD'), 'never')
       || '|' || coalesce(f.consecutive_failures::text, '-') || '|' || coalesce(left(f.last_error, 60), '-')
  FROM publishers p JOIN countries c ON c.id = p.country_id
  LEFT JOIN last l ON l.publisher_id = p.id
  LEFT JOIN LATERAL (SELECT * FROM feeds WHERE publisher_id = p.id AND enabled ORDER BY last_success_at DESC NULLS LAST LIMIT 1) f ON true
 WHERE p.feed_status = 'active' AND (l.last_fetch IS NULL OR l.last_fetch < now() - interval '14 days')
 ORDER BY (f.consecutive_failures > 0) DESC, l.last_fetch NULLS FIRST, p.id;
SELECT 'total|active|' || count(*) FROM publishers WHERE feed_status = 'active';
