-- Read-only: related existing profiles (consistency for release 4) and feed health of the 11 publishers.
\set ON_ERROR_STOP on
SET statement_timeout = '30s';
SELECT 'rel|' || p.id || '|' || p.name || '|' || c.iso_code || '|' || array_to_string(e.classification_tags, ',') || '|' || e.confidence || '|' || coalesce(e.ownership_type,'') || '|' || left(coalesce(e.owner,''), 160)
  FROM editorial_profiles e JOIN publishers p ON p.id = e.publisher_id JOIN countries c ON c.id = p.country_id
 WHERE c.iso_code IN ('MZ','LS','NA','SC','AO','GE') OR p.id = 165 OR e.owner ILIKE '%Africa Media Holdings%' OR e.owner ILIKE '%Free Press%' OR e.owner ILIKE '%Notícias%' ORDER BY c.iso_code, p.id;
SELECT 'feed|' || f.publisher_id || '|' || f.feed_url || '|' || coalesce(f.last_status,'-') || '|ok ' || coalesce(to_char(f.last_success_at,'MM-DD HH24:MI'),'never') || '|fails ' || f.consecutive_failures
       || '|' || (SELECT count(*) FROM articles a WHERE a.publisher_id = f.publisher_id AND a.fetched_at > now() - interval '3 days') || ' in 3d'
  FROM feeds f WHERE f.publisher_id IN (8926, 8952, 8913, 8953, 8912, 8964, 8928, 8933, 8929, 8949, 1066) AND f.enabled ORDER BY f.publisher_id;
