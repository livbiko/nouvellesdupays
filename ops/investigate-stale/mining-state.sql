SELECT 'african_active|' || count(*) FROM publishers p JOIN countries c ON c.id = p.country_id
 WHERE p.feed_status = 'active' AND c.region IN ('West Africa','East Africa','Central Africa','North Africa','Southern Africa');
SELECT 'mined|' || count(*) || '|oldest=' || min(mined_at) || '|newest=' || max(mined_at) || '|due_now=' || count(*) FILTER (WHERE mined_at < now() - interval '14 days') FROM discovery_mining_log;
SELECT 'never_mined_african|' || count(*) FROM publishers p JOIN countries c ON c.id = p.country_id LEFT JOIN discovery_mining_log m ON m.publisher_id = p.id
 WHERE p.feed_status = 'active' AND c.region IN ('West Africa','East Africa','Central Africa','North Africa','Southern Africa') AND m.publisher_id IS NULL;
SELECT 'queue|' || status || '|' || count(*) FROM discovered_sources GROUP BY status ORDER BY status;
SELECT 'queue_ready|under_review with feed=' || count(*) FILTER (WHERE status = 'under_review' AND feed_url IS NOT NULL AND health = 'ok') FROM discovered_sources;
