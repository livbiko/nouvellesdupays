-- Part 1 (owner, 2026-11-06: "clean up 1 and 2"): delete article rows whose headline contains U+FFFD (stored before the
-- Build #182 charset fix) when the same publisher holds a clean row for the same original_url (re-stored after the fix,
-- the dedup hash being on the raw title). Publishers: Correio da Manhã 539, Folha 10003, Reforma 10002, El Nacional 9858.
-- Every deleted row is printed in full as CSV first (restore record). Nothing references articles by foreign key.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '120s';
BEGIN;
CREATE TEMP TABLE del AS
  SELECT a.id FROM articles a
  WHERE a.publisher_id IN (539, 10003, 10002, 9858) AND a.headline LIKE '%' || chr(65533) || '%'
    AND EXISTS (SELECT 1 FROM articles b WHERE b.publisher_id = a.publisher_id AND b.original_url = a.original_url
                  AND b.id <> a.id AND b.headline NOT LIKE '%' || chr(65533) || '%');
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM del;
  IF n NOT BETWEEN 250 AND 450 THEN RAISE EXCEPTION 'Expected about 285 broken rows with a clean twin, found % - nothing changed', n; END IF;
END $do$;
\echo ===DELETED-ROWS-CSV-BEGIN===
COPY (SELECT a.* FROM articles a JOIN del USING (id) ORDER BY a.id) TO STDOUT WITH CSV HEADER;
\echo ===DELETED-ROWS-CSV-END===
DELETE FROM articles WHERE id IN (SELECT id FROM del);
SELECT 'after', p.slug, count(*) FILTER (WHERE a.headline LIKE '%' || chr(65533) || '%') broken_left
FROM articles a JOIN publishers p ON p.id = a.publisher_id WHERE a.publisher_id IN (539, 10003, 10002, 9858) GROUP BY 2 ORDER BY 2;
COMMIT;
