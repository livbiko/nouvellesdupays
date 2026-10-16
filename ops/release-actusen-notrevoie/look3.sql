-- Read-only, part 2: the articles stored for Actusen (8905) and Notre Voie (8894), and what references articles.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
SELECT 'nv|' || a.id || '|' || to_char(a.published_at, 'YYYY-MM-DD') || '|' || left(a.headline, 80) || '|' || left(a.original_url, 80) FROM articles a WHERE a.publisher_id = 8894 ORDER BY a.published_at DESC NULLS LAST LIMIT 5;
SELECT 'fk|' || conrelid::regclass::text || '|' || conname::text || '|' || confdeltype::text FROM pg_constraint WHERE confrelid = 'articles'::regclass;
SELECT 'colcount|' || count(*) FROM information_schema.columns WHERE table_name = 'articles';
