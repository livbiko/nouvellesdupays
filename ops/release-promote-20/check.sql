SELECT d.id, d.domain, d.status, d.health, coalesce(d.language,'-'), coalesce(d.html_lang,'-'), c.iso_code, d.feed_type, (d.feed_url IS NOT NULL),
  (SELECT count(*) FROM publishers p WHERE lower(split_part(regexp_replace(p.domain, '^www\.', ''), '/', 1)) = d.domain) AS pub_dup,
  (SELECT count(*) FROM publisher_submissions s WHERE lower(split_part(regexp_replace(coalesce(s.domain,''), '^www\.', ''), '/', 1)) = d.domain) AS sub_dup
FROM discovered_sources d LEFT JOIN countries c ON c.id = d.country_id
WHERE d.id IN (217,171,243,15,257,196,4,280,3,218,296,206,172,240,48,36,169,311,321,178) ORDER BY d.id;
SELECT 'submissions_now', count(*), count(*) FILTER (WHERE status IN ('pending','submitted')) FROM publisher_submissions;
