-- Build #199 rollback: Global Times feed 963 back to its RSS feed. The worker refetches it in full on its next run.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET feed_url = 'https://www.globaltimes.cn/rss/outbrain.xml', feed_type = 'rss', etag = NULL, last_modified = NULL
  WHERE id = 963 AND feed_url = 'https://www.globaltimes.cn/sitemap.xml';
SELECT id, feed_url, feed_type FROM feeds WHERE id = 963;
COMMIT;
