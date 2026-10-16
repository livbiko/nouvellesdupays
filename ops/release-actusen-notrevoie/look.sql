-- Read-only: current state of Actusen (8905) and Notre Voie (8894), their feeds, and the hijacked actusen.com articles.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'pub|' || row_to_json(p)::text FROM publishers p WHERE id IN (8905, 8894);
SELECT 'feed|' || row_to_json(f)::text FROM feeds f WHERE publisher_id IN (8905, 8894);
SELECT 'col|' || column_name || '|' || data_type FROM information_schema.columns WHERE table_name = 'articles' ORDER BY ordinal_position;
SELECT 'host|' || a.publisher_id || '|' || coalesce(substring(to_jsonb(a)->>'source_url' from '^https?://([^/]+)'), substring(to_jsonb(a)->>'canonical_url' from '^https?://([^/]+)'), '-') || '|' || count(*) || '|' || min(a.fetched_at)::date || '|' || max(a.fetched_at)::date
  FROM articles a WHERE a.publisher_id IN (8905, 8894) GROUP BY 1 ORDER BY 1;
SELECT 'recent|' || a.id || '|' || to_char(a.fetched_at, 'YYYY-MM-DD') || '|' || left(a.title, 90) FROM articles a WHERE a.publisher_id = 8905 ORDER BY a.fetched_at DESC LIMIT 15;
SELECT 'oldest|' || a.id || '|' || to_char(a.fetched_at, 'YYYY-MM-DD') || '|' || left(a.title, 90) FROM articles a WHERE a.publisher_id = 8905 ORDER BY a.fetched_at LIMIT 8;
SELECT 'fk|' || conrelid::regclass || '|' || conname FROM pg_constraint WHERE confrelid = 'articles'::regclass;
