-- Read-only: Build #87 follow-up -- articles stored since the date rules (2026-10-17 21:17 UTC) by the 4 crawled sources.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'since|' || p.id || '|' || p.name || '|' || count(a.id) || ' new|dated=' || count(a.published_at) || '|' || coalesce(f.last_status, '-') || '|' || coalesce(to_char(f.last_fetched_at, 'HH24:MI'), '-')
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id AND f.enabled
  LEFT JOIN articles a ON a.publisher_id = p.id AND a.fetched_at > TIMESTAMPTZ '2026-10-17 21:17:00+00'
 WHERE p.id IN (8949, 8950, 8956, 8965) GROUP BY p.id, p.name, f.last_status, f.last_fetched_at ORDER BY p.id;
SELECT 'sample|' || publisher_id || '|' || coalesce(to_char(published_at, 'YYYY-MM-DD HH24:MI'), 'NULL') || '|' || left(headline, 60)
  FROM (SELECT *, row_number() OVER (PARTITION BY publisher_id ORDER BY fetched_at DESC) rn FROM articles WHERE publisher_id IN (8949, 8950, 8956, 8965) AND fetched_at > TIMESTAMPTZ '2026-10-17 21:17:00+00') s WHERE rn <= 2;
