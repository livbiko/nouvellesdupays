-- Read-only: existing profiles of related outlets (consistency for release 3) and the tag combinations in use.
\set ON_ERROR_STOP on
SET statement_timeout = '30s';
SELECT 'rel|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || array_to_string(e.classification_tags, ',') || '|' || e.confidence || '|' || coalesce(e.ownership_type,'') || '|' || left(coalesce(e.owner,''), 160)
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id JOIN countries c ON c.id = p.country_id
 WHERE c.iso_code IN ('SO','ET','UG','KE') OR e.owner ILIKE '%Standard Group%' OR e.owner ILIKE '%Nation Media%' ORDER BY c.iso_code, p.id;
SELECT 'combo|' || array_to_string(classification_tags, ',') || '|' || count(*) FROM editorial_profiles GROUP BY classification_tags ORDER BY count(*) DESC;
