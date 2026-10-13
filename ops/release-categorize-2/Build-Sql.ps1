# Writes apply.sql / reverse.sql / rehearse.sql / verify.sql for the current category-map.csv (id,old,new).
# Run after every (re)generation of the mapping; the row count and md5 are baked in as guards.
Set-Location $PSScriptRoot
$rows = @(Get-Content category-map.csv | Select-Object -Skip 1 | Where-Object { $_ })
$n = $rows.Count
$md5 = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash(
  [Text.Encoding]::ASCII.GetBytes(($rows -join "`n")))).Replace('-', '').ToLower()

$hdr = @"
-- Category backfill for the categorizer keyword exceptions (fix 6fdb75b). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's headline-only result and
-- whose NEW headline-only result differs ($n rows, md5 $md5 over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
\set ON_ERROR_STOP on
"@
$load = @"
CREATE TEMP TABLE category_map (id bigint PRIMARY KEY, old text NOT NULL, new text NOT NULL);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
DO `$`$
BEGIN
  IF (SELECT count(*) FROM category_map) <> $n THEN RAISE EXCEPTION 'category_map has % rows, expected $n', (SELECT count(*) FROM category_map); END IF;
  IF (SELECT md5(string_agg(id || ',' || old || ',' || new, E'\n' ORDER BY id)) FROM category_map) <> '$md5' THEN
    RAISE EXCEPTION 'category_map content differs from the CSV this file was built for'; END IF;
END `$`$;
"@
$guardApply = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM category_map m LEFT JOIN articles a ON a.id = m.id WHERE a.id IS NOT NULL AND a.category NOT IN (m.old, m.new)) THEN
    RAISE EXCEPTION 'some mapped articles have a third category value (changed since the mapping was made)'; END IF;
END `$`$;
"@
$update = "UPDATE articles a SET category = m.new FROM category_map m WHERE a.id = m.id AND a.category = m.old;"
$undo   = "UPDATE articles a SET category = m.old FROM category_map m WHERE a.id = m.id AND a.category = m.new;"
$fp = @"
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
"@
$state = "select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;"

Set-Content -Encoding ascii apply.sql    ($hdr, 'BEGIN;', $load, $guardApply, $update, $state, 'COMMIT;' -join "`n")
Set-Content -Encoding ascii reverse.sql  ("-- Reverse of apply.sql: mapped articles back to their old category (only where still at the new one).", $hdr, 'BEGIN;', $load, $undo, $state, 'COMMIT;' -join "`n")
Set-Content -Encoding ascii verify.sql   ($hdr, $load, $state, $fp -join "`n")
Set-Content -Encoding ascii rehearse.sql ($hdr, 'BEGIN;', $load, $fp, $state, $guardApply, $update, $state, $fp, $undo, $state, $fp, 'ROLLBACK;' -join "`n")
"built for $n rows, md5 $md5"
