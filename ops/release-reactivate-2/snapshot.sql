SELECT p.id, p.name, p.feed_status, s.id, s.status, left(s.reviewer_note, 50), f.id, f.feed_type, f.feed_url, f.enabled, coalesce(to_char(f.last_fetched_at,'MM-DD HH24:MI'),'-'), (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id)
FROM publishers p JOIN publisher_submissions s ON s.publisher_id = p.id JOIN feeds f ON f.publisher_id = p.id WHERE p.id IN (8918, 8922) ORDER BY p.id;
