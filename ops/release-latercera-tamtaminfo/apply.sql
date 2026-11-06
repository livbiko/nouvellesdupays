-- Owner, 2026-11-06: "do 1 and 2".
-- 1) La Tercera (CL, feed 6758): its main feed (arc/outboundfeeds/rss/?outputType=xml) returns an empty body since
--    11-05 ~20:40 UTC; the "nacional" section feed works (74 items, dates correct, Node fetch 200, robots allows).
--    Feed URL switched; error state left for the worker to clear on its next success.
-- 2) TamTamInfo (NE, publisher 205): www.tamtaminfo.com and tamtaminfo.com have no DNS records (likely expired) ->
--    feed_status 'unavailable', record kept, recheck monthly.
-- rehearse.sql = ROLLBACK; reverse.sql restores.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 6758 AND p.slug = 'la-tercera'
                 AND f.feed_url = 'https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml')
     OR NOT EXISTS (SELECT 1 FROM publishers WHERE id = 205 AND slug = 'tamtaminfo' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'La Tercera / TamTamInfo not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET feed_url = 'https://www.latercera.com/arc/outboundfeeds/rss/category/nacional/?outputType=xml', etag = NULL, last_modified = NULL
 WHERE id = 6758;
UPDATE publishers SET feed_status = 'unavailable' WHERE id = 205;
SELECT 'feed', id, feed_url FROM feeds WHERE id = 6758;
SELECT 'publisher', id, slug, feed_status FROM publishers WHERE id = 205;
COMMIT;
