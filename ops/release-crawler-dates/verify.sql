\set ON_ERROR_STOP on
SELECT 'new|' || p.id || '|' || p.name || '|' || count(a.id) || '|dated=' || count(a.published_at) || '|' || coalesce(f.last_status, '-') || '|' || coalesce(left(f.last_error, 60), '-')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id AND f.enabled
  LEFT JOIN articles a ON a.publisher_id = p.id AND a.fetched_at > TIMESTAMPTZ '2026-10-17 21:06:13+00'
 WHERE p.id IN (8949, 8950, 8956, 8965) GROUP BY p.id, p.name, f.last_status, f.last_error ORDER BY p.id;
