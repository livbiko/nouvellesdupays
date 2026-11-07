-- Build #186 (HIGH, owner approved the window 2026-11-06: "approve the window"). Same statement as
-- db/migrations/017_articles_publisher_url_index.sql, plus timing and a validity check. No transaction: CONCURRENTLY.
SET statement_timeout = 0;
\timing on
SELECT 'before', count(*) FROM pg_indexes WHERE tablename = 'articles' AND indexname = 'idx_articles_publisher_url_md5';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_publisher_url_md5 ON articles (publisher_id, md5(original_url));
SELECT 'after', c.relname, i.indisvalid, i.indisready, pg_size_pretty(pg_relation_size(c.oid))
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'idx_articles_publisher_url_md5';
