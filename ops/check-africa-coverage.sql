-- Check African country publisher coverage.
-- Run via Sql.ps1 against the DB to identify thinly-covered countries.
SELECT
  c.iso_code,
  c.name AS country_name,
  c.region,
  c.sub_region,
  count(p.id) FILTER (WHERE p.feed_status = 'active')  AS active_publishers,
  count(p.id) FILTER (WHERE p.feed_status != 'active') AS inactive_publishers,
  count(p.id) AS total_publishers
FROM countries c
LEFT JOIN publishers p ON p.country_id = c.id
WHERE c.region LIKE '%Africa%'
GROUP BY c.iso_code, c.name, c.region, c.sub_region
ORDER BY active_publishers ASC, c.sub_region, c.name;
