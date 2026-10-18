\set ON_ERROR_STOP on
SELECT 'new|' || count(*) || '|dated=' || count(published_at) || '|cyrillic=' || count(*) FILTER (WHERE headline ~ '[А-Яа-я]') FROM articles WHERE publisher_id = 1034 AND fetched_at > TIMESTAMPTZ '2026-10-18 10:00:27+00';
SELECT 'sample|' || coalesce(published_at::text, 'NULL') || '|' || left(headline, 70) FROM articles WHERE publisher_id = 1034 AND fetched_at > TIMESTAMPTZ '2026-10-18 10:00:27+00' ORDER BY published_at DESC NULLS LAST LIMIT 3;

