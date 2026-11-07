-- Rollback for Build #186: drop the index without blocking writes. Safe while the old worker runs; the new worker
-- still works without it, only slower (falls back to the (publisher_id, published_at) index).
SET statement_timeout = 0;
DROP INDEX CONCURRENTLY IF EXISTS idx_articles_publisher_url_md5;
