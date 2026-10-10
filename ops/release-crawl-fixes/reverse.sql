-- Exact reverse of fix.sql (state in snapshot-before.txt). Needs /tmp/articles-crawl-junk.csv in the postgres pod.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET feed_type = 'sitemap', feed_url = 'https://www.modernghana.com/sitemap.xml', category_urls = '{}', article_url_patterns = '{}' WHERE id = 8917;
UPDATE publisher_submissions SET status = 'active', reviewer_note = NULL WHERE id IN (70, 80, 89, 91, 92) AND status = 'suspended';
UPDATE publishers SET feed_status = 'active' WHERE id IN (8914, 8918, 8922, 8923, 8924);
\copy articles FROM '/tmp/articles-crawl-junk.csv' WITH CSV HEADER
COMMIT;
