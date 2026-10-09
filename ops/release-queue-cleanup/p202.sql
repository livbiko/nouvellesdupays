SELECT 'feeds202', f.id, f.feed_url, f.feed_type, f.created_at::timestamp(0), f.enabled, (SELECT count(*) FROM articles a WHERE a.feed_id = f.id) FROM feeds f WHERE f.publisher_id = 202 ORDER BY f.id;
SELECT 'cand258', homepage_url, discovered_from FROM discovered_sources WHERE id = 258;
SELECT 'sub45', homepage_url, feed_url, reviewed_at::timestamp(0) FROM publisher_submissions WHERE id = 45;
SELECT 'ivoirematin_articles', c.iso_code, count(*) FROM articles a JOIN countries c ON c.id = a.country_id WHERE a.publisher_id = 8880 GROUP BY c.iso_code;
SELECT 'other_name_collisions', s.id, s.name, s.publisher_id, p.created_at::date FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id
 WHERE s.status = 'approved' AND p.created_at < s.reviewed_at - interval '1 minute' AND s.reviewed_at > '2026-10-09';
