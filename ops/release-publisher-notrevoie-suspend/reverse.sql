-- Reverses Build #207: Notre Voie (8894) back to 'unavailable', feed 8892 re-enabled.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE publishers SET feed_status = 'unavailable' WHERE id = 8894 AND feed_status = 'suspended';
UPDATE feeds SET enabled = true WHERE id = 8892 AND NOT enabled;
SELECT p.id, p.slug, p.feed_status, f.id, f.enabled FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8894;
COMMIT;
