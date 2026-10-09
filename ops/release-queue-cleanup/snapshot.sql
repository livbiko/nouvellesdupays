SELECT 'sub', s.id, s.status, coalesce(s.reviewer_note,'NULL'), coalesce(s.publisher_id::text,'NULL'), c.iso_code, left(s.name,40),
       coalesce(p.feed_status,'-'), d.id AS cand, d.status AS cand_status, md5(coalesce(d.notes,''))
FROM publisher_submissions s JOIN countries c ON c.id = s.country_id
LEFT JOIN publishers p ON p.id = s.publisher_id
LEFT JOIN discovered_sources d ON d.promoted_submission_id = s.id
WHERE s.id IN (45,46,53,40, 69,61,73,67,98,72,83,82,93,64,63,88,62,71,57,51,56,68,77,84,90)
ORDER BY s.id;
SELECT 'ivoirematin_articles', c.iso_code, count(*) FROM articles a JOIN countries c ON c.id = a.country_id
 WHERE a.publisher_id = (SELECT publisher_id FROM publisher_submissions WHERE id = 40) GROUP BY 1;
SELECT 'ci_conflict', count(*) FROM publishers p JOIN countries c ON c.id = p.country_id
 WHERE c.iso_code = 'CI' AND (p.name = 'Ivoirematin' OR lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1)) = 'ivoirematin.com');
SELECT 'pub_articles', s.id, count(a.id) FROM publisher_submissions s LEFT JOIN articles a ON a.publisher_id = s.publisher_id WHERE s.id IN (45,46,53) GROUP BY s.id ORDER BY 2;
