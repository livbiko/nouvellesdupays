-- Read-only, part 2: the articles stored for Actusen (8905) and Notre Voie (8894), and what references articles.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'host|' || a.publisher_id || '|' || coalesce(substring(a.original_url from '^https?://([^/]+)'), '-') || '|' || count(*) || '|' || min(a.fetched_at)::date || '|' || max(a.fetched_at)::date
  FROM articles a WHERE a.publisher_id IN (8905, 8894) GROUP BY a.publisher_id, substring(a.original_url from '^https?://([^/]+)') ORDER BY 1;
SELECT 'cat|' || c || '|' || n FROM (SELECT coalesce(a.category, '-') c, count(*) n FROM articles a WHERE a.publisher_id = 8905 GROUP BY 1) x ORDER BY n DESC;
SELECT 'recent|' || a.id || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 90) FROM articles a WHERE a.publisher_id = 8905 ORDER BY a.published_at DESC NULLS LAST LIMIT 12;
SELECT 'oldest|' || a.id || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 90) FROM articles a WHERE a.publisher_id = 8905 ORDER BY a.published_at NULLS LAST LIMIT 6;
SELECT 'nv|' || a.id || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 80) || '|' || left(a.original_url, 80) FROM articles a WHERE a.publisher_id = 8894 ORDER BY a.published_at DESC NULLS LAST LIMIT 5;
SELECT 'fk|' || conrelid::regclass || '|' || conname || '|' || confdeltype FROM pg_constraint WHERE confrelid = 'articles'::regclass;
SELECT 'colcount|' || count(*) FROM information_schema.columns WHERE table_name = 'articles';
