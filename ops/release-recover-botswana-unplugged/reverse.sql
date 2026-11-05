-- Reverses Build #164: publisher 273 back to unavailable with its previous feed state. Articles fetched after the
-- recovery stay (real Botswana Unplugged items).
\set ON_ERROR_STOP on
BEGIN;
UPDATE publishers SET feed_status = 'unavailable' WHERE id = 273;
UPDATE feeds SET last_status = 'error: fetch failed', last_error = 'fetch failed', last_error_at = '2026-10-08 02:25:09.349211+00',
  consecutive_failures = 1562, etag = '"b3c5b87c71c1546fa8940dcdbff5b002"', last_modified = 'Wed, 09 Sep 2026 15:00:58 GMT' WHERE id = 273;
COMMIT;
