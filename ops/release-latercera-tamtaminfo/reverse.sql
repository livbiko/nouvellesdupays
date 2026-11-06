-- Reverses: La Tercera back to its main feed URL, TamTamInfo back to active.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET feed_url = 'https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml' WHERE id = 6758;
UPDATE publishers SET feed_status = 'active' WHERE id = 205 AND feed_status = 'unavailable';
COMMIT;
