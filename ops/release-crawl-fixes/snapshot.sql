SELECT 'pub', p.id, p.name, p.feed_status, s.id AS sub, s.status, f.id AS feed, f.feed_type, f.feed_url, array_to_string(f.category_urls, ' '), array_to_string(f.article_url_patterns, ' '), f.enabled,
  (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) AS articles
FROM publishers p JOIN publisher_submissions s ON s.publisher_id = p.id JOIN feeds f ON f.publisher_id = p.id
WHERE p.id IN (8914, 8918, 8919, 8922, 8923, 8924) ORDER BY p.id;
SELECT 'art', a.id, a.publisher_id, left(a.headline, 60) FROM articles a WHERE a.publisher_id IN (8914, 8918, 8919, 8922, 8923, 8924) ORDER BY a.id;
