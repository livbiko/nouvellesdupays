\set ON_ERROR_STOP on
SELECT 'new|' || p.id || '|' || p.name || '|' || count(a.id) || '|' || coalesce(f.last_status, '-') || '|' || coalesce(f.consecutive_failures::text, '-')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id AND f.enabled
  LEFT JOIN articles a ON a.publisher_id = p.id AND a.fetched_at > TIMESTAMPTZ '2026-10-17 20:04:33+00'
 WHERE p.id IN (230, 1052, 301) GROUP BY p.id, p.name, f.last_status, f.consecutive_failures ORDER BY p.id;
