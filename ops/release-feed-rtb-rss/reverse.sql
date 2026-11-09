-- Build #203 rollback: RTB feed 8921 back to the homepage crawl it was before (it stored nothing that way).
-- Articles stored from the RSS stay; delete them separately only if wanted (feed_id = 8921).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET feed_url = 'http://www.rtb.bf/', feed_type = 'html', etag = NULL, last_modified = NULL
  WHERE id = 8921 AND feed_url = 'https://www.rtb.bf/feed/';
SELECT id, feed_url, feed_type FROM feeds WHERE id = 8921;
COMMIT;
