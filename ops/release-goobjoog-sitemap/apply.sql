-- Build #130 (MEDIUM): Goobjoog News (SO, publisher 8348) -- /feed/ is 404 since 10-20, robots.txt advertises a live
-- Somali news sitemap. Same feed type the worker already uses for 13 feeds (e.g. guardian.ng).
BEGIN;
UPDATE feeds SET feed_url='https://goobjoog.com/news-sitemap.xml', feed_type='sitemap-news',
       consecutive_failures=0, last_error=NULL, last_error_at=NULL, etag=NULL, last_modified=NULL
 WHERE id=8346 AND feed_url='https://goobjoog.com/feed/';
SELECT id, feed_type, feed_url, consecutive_failures FROM feeds WHERE id=8346;
COMMIT;
