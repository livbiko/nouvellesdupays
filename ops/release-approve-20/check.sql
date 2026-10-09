SELECT d.id AS cand, s.id AS sub, s.status, s.feed_verified, s.feed_type, s.language, c.iso_code, s.name, s.ingestion_method,
  d.source_type,
  (SELECT count(*) FROM publishers p WHERE lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1)) = d.domain) AS pub_dup,
  (SELECT count(*) FROM publishers p WHERE p.country_id = s.country_id AND p.name = s.name) AS name_dup,
  (SELECT count(*) FROM feeds f WHERE f.feed_url = s.feed_url) AS feed_dup
FROM discovered_sources d JOIN publisher_submissions s ON s.id = d.promoted_submission_id JOIN countries c ON c.id = s.country_id
WHERE d.id IN (217,171,243,15,257,196,4,280,3,218,296,206,172,240,48,36,169,311,321,178) ORDER BY s.id;
