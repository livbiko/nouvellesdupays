-- Read-only: every active crawled source and its last result.
SELECT 'c|' || f.id || '|' || p.id || '|' || left(p.name, 30) || '|' || f.feed_type || '|' || coalesce(to_char(f.last_fetched_at, 'HH24:MI'), '-') || '|' || coalesce(left(f.last_status, 60), '-') || '|' || coalesce(to_char(f.last_success_at, 'MM-DD HH24:MI'), '-') || '|' || f.consecutive_failures
FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.feed_status = 'active' AND f.enabled AND f.feed_type IN ('html', 'sitemap') ORDER BY f.id;
