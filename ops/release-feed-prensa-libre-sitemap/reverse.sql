-- Build #198 rollback: Prensa Libre feed 1515 back to its RSS feed. The worker refetches it in full on its next run.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET feed_url = 'https://www.prensalibre.com/feed', feed_type = 'rss', etag = NULL, last_modified = NULL
  WHERE id = 1515 AND feed_url = 'https://www.prensalibre.com/news-sitemap.xml';
SELECT id, feed_url, feed_type FROM feeds WHERE id = 1515;
COMMIT;
