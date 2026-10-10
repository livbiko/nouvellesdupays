SELECT 'sub', s.id, s.status, s.ingestion_method, coalesce(s.sitemap_url,'-'), s.homepage_url, c.iso_code, s.language, s.name,
  array_length(s.category_urls,1), array_length(s.article_url_patterns,1), coalesce(s.publisher_id::text,'-'),
  (SELECT count(*) FROM publishers p WHERE p.country_id = s.country_id AND lower(p.name) = lower(trim(s.name))) AS name_dup,
  (SELECT count(*) FROM publishers p WHERE lower(regexp_replace(regexp_replace(p.domain, '^www\.', ''), '/+$', ''))
     = split_part(lower(regexp_replace(regexp_replace(s.homepage_url, '^https?://', ''), '^www\.', '')), '/', 1)) AS dom_dup,
  (SELECT count(*) FROM feeds f WHERE f.feed_url = coalesce(s.sitemap_url, s.homepage_url)) AS feed_dup,
  d.id AS cand, d.source_type
FROM publisher_submissions s JOIN countries c ON c.id = s.country_id LEFT JOIN discovered_sources d ON d.promoted_submission_id = s.id
WHERE s.id IN (78,92,91,80,79,76,81,89,70,86,87,94) ORDER BY s.id;
SELECT 'setting', key, value::text FROM app_settings WHERE key = 'crawler_default_frequency_minutes';
