SELECT p.id, left(p.name, 28), p.language, p.source_type, f.last_status, to_char(f.last_fetched_at, 'HH24:MI'), count(a.id) AS articles
FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
LEFT JOIN feeds f ON f.publisher_id = p.id
LEFT JOIN articles a ON a.publisher_id = p.id
WHERE s.id IN (38,39,41,42,43,44,47,48,50,52,49,55,58,59,60,66,74,132,133,134)
GROUP BY p.id, p.name, p.language, p.source_type, f.last_status, f.last_fetched_at ORDER BY p.id;
SELECT 'now', to_char(now(), 'HH24:MI');
