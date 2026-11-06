-- Part 2 (owner, 2026-11-06: "clean up 1 and 2"): Correio da Manhã (539) headlines stored before 10-07 carry the feed's
-- escaped CDATA literally ("<![CDATA[ ... ]]>"). Keep only the text inside. Headline only; dedup_hash unchanged.
-- Old headlines are printed first (restore record). Updated in batches of 2,000 rows, each committed on its own, with a
-- 4 s pause, so worker inserts are never blocked for long (lesson from 10-14).
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
\echo ===OLD-HEADLINES-CSV-BEGIN===
COPY (SELECT id, headline FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' ORDER BY id) TO STDOUT WITH CSV HEADER;
\echo ===OLD-HEADLINES-CSV-END===
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
UPDATE articles SET headline = btrim(regexp_replace(headline, '^<!\[CDATA\[(.*)\]\]>$', '\1'))
 WHERE id IN (SELECT id FROM articles WHERE publisher_id = 539 AND headline LIKE '<![CDATA[%' AND headline LIKE '%]]>' ORDER BY id LIMIT 2000);
SELECT pg_sleep(4);
SELECT 'after', count(*) FILTER (WHERE headline LIKE '<![CDATA[%') cdata_left, count(*) total FROM articles WHERE publisher_id = 539;
SELECT 'sample', id, left(headline, 70) FROM articles WHERE publisher_id = 539 AND fetched_at < '2026-10-08' ORDER BY id DESC LIMIT 3;
