-- Read-only. One 'snap|<table>|<base64 row JSON>' line per row apply.sql changes, for reverse.sql.
SELECT 'snap|publishers|' || translate(encode(convert_to(row_to_json(t)::text, 'UTF8'), 'base64'), E'\n', '') FROM publishers t WHERE id IN (270, 8951) ORDER BY id;
SELECT 'snap|feeds|' || translate(encode(convert_to(row_to_json(t)::text, 'UTF8'), 'base64'), E'\n', '') FROM feeds t WHERE id = 270;
SELECT 'snap|publisher_submissions|' || translate(encode(convert_to(row_to_json(t)::text, 'UTF8'), 'base64'), E'\n', '') FROM publisher_submissions t WHERE id IN (137, 161, 168, 169, 170, 171) ORDER BY id;
SELECT 'snap|discovered_sources|' || translate(encode(convert_to(row_to_json(t)::text, 'UTF8'), 'base64'), E'\n', '') FROM discovered_sources t WHERE id IN (382, 314, 357, 425, 477) ORDER BY id;
