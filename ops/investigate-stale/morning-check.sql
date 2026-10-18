-- Read-only, 2026-10-18 morning: Build #87 (crawler word dates) and Build #89 (Le Patriote crawler) follow-up.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'since|' || p.id || '|' || p.name || '|' || count(a.id) || ' new|dated=' || count(a.published_at) || '|newest_pub=' || coalesce(max(a.published_at)::text, '-') || '|' || coalesce(f.last_status, '-') || '|last_fetch=' || coalesce(to_char(f.last_fetched_at, 'MM-DD HH24:MI'), '-')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id AND f.enabled
  LEFT JOIN articles a ON a.publisher_id = p.id AND a.fetched_at > TIMESTAMPTZ '2026-10-17 21:17:00+00'
 WHERE p.id IN (8949, 8950, 8956, 8965, 7291) GROUP BY p.id, p.name, f.last_status, f.last_fetched_at ORDER BY p.id;
SELECT 'sample|' || publisher_id || '|' || coalesce(to_char(published_at, 'YYYY-MM-DD HH24:MI'), 'NULL') || '|' || left(headline, 60)
  FROM (SELECT *, row_number() OVER (PARTITION BY publisher_id ORDER BY fetched_at DESC) rn FROM articles WHERE publisher_id IN (8949, 8950, 8956, 8965, 7291) AND fetched_at > TIMESTAMPTZ '2026-10-17 21:17:00+00') s WHERE rn <= 2;
SELECT 'ci100|' || min(published_at)::text || ' is the oldest of the latest 100 Cote d''Ivoire articles' FROM (SELECT published_at FROM articles a JOIN countries c ON c.id = a.country_id WHERE c.iso_code = 'CI' AND a.published_at <= now() ORDER BY a.published_at DESC NULLS LAST LIMIT 100) x;
