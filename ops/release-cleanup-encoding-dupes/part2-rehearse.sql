-- REHEARSAL (ROLLBACK), sample only: one batch of 2,000 inside a transaction, then roll back.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
SELECT 'before', count(*) FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%';
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT 'sample', id, left(headline, 70) FROM articles WHERE publisher_id = 539 AND headline NOT LIKE '<![CDATA[%' AND fetched_at < '2026-10-08' ORDER BY id LIMIT 3;
SELECT 'left-in-txn', count(*) FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%';
ROLLBACK;
