-- Read-only: Journal de Kinshasa (5299) and Journal du Tchad (216) -- publisher, feeds, profile, recent articles.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'pub|' || p.id || '|' || p.name || '|' || p.feed_status || '|' || coalesce(p.homepage_url,'-') || '|' || coalesce(p.domain,'-') || '|' || c.iso_code FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.id IN (5299, 216) ORDER BY p.id;
SELECT 'feed|' || f.id || '|' || f.publisher_id || '|' || f.feed_url || '|' || f.enabled || '|' || coalesce(f.last_status,'-') || '|' || coalesce(f.last_success_at::text,'-') || '|' || f.consecutive_failures || '|' || coalesce(f.last_error,'-') FROM feeds f WHERE f.publisher_id IN (5299, 216) ORDER BY f.id;
SELECT 'prof|' || e.id || '|' || e.publisher_id || '|' || array_to_string(e.classification_tags, ',') || '|' || e.confidence || '|' || e.review_required || '|' || e.classification_date || '|' || coalesce(e.owner,'NULL') || '|' || coalesce(e.current_context,'NULL') FROM editorial_profiles e WHERE e.publisher_id IN (5299, 216) ORDER BY e.publisher_id;
SELECT 'art|' || a.publisher_id || '|' || count(*) || '|' || coalesce(max(a.fetched_at)::text,'-') FROM articles a WHERE a.publisher_id IN (5299, 216) AND a.fetched_at > now() - interval '7 days' GROUP BY a.publisher_id;
SELECT 'cols|' || string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'editorial_profiles';
