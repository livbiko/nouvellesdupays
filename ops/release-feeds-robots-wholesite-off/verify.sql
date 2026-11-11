SELECT id, enabled, last_fetched_at FROM feeds WHERE id IN (268, 627, 967, 1064) ORDER BY id;
SELECT count(*) FILTER (WHERE last_fetched_at > '2026-11-11 10:50:00+00') AS polled_since_1050,
       count(*) FILTER (WHERE last_fetched_at > '2026-11-11 10:50:00+00' AND id IN (268, 627, 967, 1064)) AS blocked_polled
FROM feeds WHERE enabled;
SELECT count(*) AS articles_since_1050 FROM articles WHERE fetched_at > '2026-11-11 10:50:00+00';
