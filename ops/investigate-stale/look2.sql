-- Read-only: articles of RMI Government (2078, hijacked), Liberte-Algerie (169, closed 2022), MadaGate (298), Madote (254), and the 3 cached feeds' rows.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'art|' || publisher_id || '|' || count(*) || '|undated=' || count(*) FILTER (WHERE published_at IS NULL) || '|min_pub=' || coalesce(min(published_at)::date::text, '-') || '|max_pub=' || coalesce(max(published_at)::date::text, '-') || '|fetched=' || coalesce(min(fetched_at)::date::text, '-') || '..' || coalesce(max(fetched_at)::date::text, '-')
  FROM articles WHERE publisher_id IN (2078, 169, 298, 254) GROUP BY publisher_id ORDER BY publisher_id;
SELECT 'sample|' || publisher_id || '|' || coalesce(published_at::date::text, 'NULL') || '|' || left(headline, 70) || '|' || left(original_url, 70)
  FROM (SELECT *, row_number() OVER (PARTITION BY publisher_id ORDER BY fetched_at DESC) rn FROM articles WHERE publisher_id IN (2078, 169)) s WHERE rn <= 3;
SELECT 'pub|' || p.id || '|' || p.name || '|' || p.feed_status || '|' || coalesce(p.domain, '-') FROM publishers p WHERE p.id IN (2078, 169, 298, 254, 230, 1052, 301) ORDER BY p.id;
SELECT 'feed|' || f.publisher_id || '|' || f.id || '|' || f.feed_type || '|' || f.enabled || '|' || f.feed_url FROM feeds f WHERE f.publisher_id IN (230, 1052, 301) ORDER BY f.publisher_id, f.id;
SELECT 'nullsort|undated articles of active publishers in the last 30 days=' || count(*) FROM articles a JOIN publishers p ON p.id = a.publisher_id WHERE p.feed_status = 'active' AND a.published_at IS NULL AND a.fetched_at > now() - interval '30 days';
