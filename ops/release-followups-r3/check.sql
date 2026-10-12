SELECT 'pub|' || p.id || '|' || p.name || '|' || f.feed_type || '|' || coalesce(to_char(f.last_fetched_at, 'HH24:MI'), '-') || '|' || coalesce(left(f.last_status, 40), '-') || '|' || (SELECT count(*) FROM articles a WHERE a.feed_id = f.id)
FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.id IN (270, 8962, 8963, 8964, 8965) AND f.enabled ORDER BY p.id;
SELECT 'okcount|' || count(*) FILTER (WHERE f.last_status LIKE 'error%') || '|' || count(*) FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE p.feed_status = 'active' AND f.enabled;
