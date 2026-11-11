-- Reverses Build #213: AllAfrica: Mauritania back to the English RDF and language en. Articles stored from the
-- French feed in the meantime stay (delete by publisher_id 4224 AND url LIKE 'https://fr.allafrica.com/%' if wanted).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
UPDATE feeds SET feed_url = 'https://allafrica.com/tools/headlines/rdf/mauritania/headlines.rdf', etag = NULL, last_modified = NULL
WHERE id = 4224 AND feed_url = 'https://fr.allafrica.com/tools/headlines/rdf/mauritania/headlines.rdf';
UPDATE publishers SET language = 'en' WHERE id = 4224 AND language = 'fr';
SELECT f.id, f.feed_url, p.language FROM feeds f JOIN publishers p ON p.id = f.publisher_id WHERE f.id = 4224;
COMMIT;
