-- Reverses Build #219: Liechtenstein-Journal (525) back to 'active', feed 525 re-enabled.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE publishers SET feed_status = 'active' WHERE id = 525 AND feed_status = 'suspended';
UPDATE feeds SET enabled = true WHERE id = 525 AND NOT enabled;
SELECT p.id, p.slug, p.feed_status, f.id, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 525;
COMMIT;
