-- Reverses the En Segundos identity step.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET parser_config = parser_config - 'accept_encoding', feed_url = 'https://www.ensegundos.com.pa/feed/' WHERE id = 9844;
COMMIT;
