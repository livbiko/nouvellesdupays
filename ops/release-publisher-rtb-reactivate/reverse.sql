-- Build #204 rollback: suspend RTB (publisher 8923) again. Articles already stored stay (hidden with the publisher).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 8923 AND feed_status = 'active';
SELECT id, slug, feed_status FROM publishers WHERE id = 8923;
COMMIT;
