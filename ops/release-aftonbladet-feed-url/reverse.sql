-- Build #225 reverse: feed 9984 back to www.aftonbladet.se/rss.xml.
BEGIN;
UPDATE feeds SET feed_url = 'https://www.aftonbladet.se/rss.xml', etag = NULL, last_modified = NULL
 WHERE id = 9984 AND feed_url = 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt';
SELECT id, feed_url FROM feeds WHERE id = 9984;
COMMIT;
