-- Lookup of an article by publisher + URL (2026-11-06). The worker's only duplicate guard was dedup_hash (publisher +
-- headline), so every edited headline stored the same URL again: 112,056 extra rows in 30 days. The worker now looks up
-- each feed item's URL first and updates the row it already holds (apps/worker/src/poll.js applyHeadlineEdits).
-- md5 of the URL rather than the URL itself: a btree entry over ~2.7 kB fails the INSERT, and URLs are unbounded.
--
-- One statement per file on purpose: CREATE INDEX CONCURRENTLY can't run inside a transaction block, and db/migrate.js
-- sends each file as one query. Built by hand on on-prem production in the Build #186 window. If a build is ever
-- interrupted it leaves an INVALID index that IF NOT EXISTS skips -- DROP INDEX CONCURRENTLY it and re-run.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_publisher_url_md5 ON articles (publisher_id, md5(original_url));
