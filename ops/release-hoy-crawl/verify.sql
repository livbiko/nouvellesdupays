\set ON_ERROR_STOP on
SELECT 'new|' || count(*) || '|dated=' || count(published_at) || '|prefixed=' || count(*) FILTER (WHERE headline LIKE 'Diario HOY%') FROM articles WHERE publisher_id = 1560 AND fetched_at > TIMESTAMPTZ '2026-10-17 21:51:05+00';
SELECT 'sample|' || coalesce(published_at::text, 'NULL') || '|' || left(headline, 70) FROM articles WHERE publisher_id = 1560 AND fetched_at > TIMESTAMPTZ '2026-10-17 21:51:05+00' ORDER BY published_at DESC NULLS LAST LIMIT 3;

