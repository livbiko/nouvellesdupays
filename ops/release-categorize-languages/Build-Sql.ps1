# Writes apply.sql / reverse.sql / rehearse.sql / verify.sql for the current category-map.csv (id,old,new).
# Run after every (re)generation of the mapping; the row count and md5 are baked in as guards.
#
# 2026-10-14 incident: a 316k-row UPDATE held in one transaction (the old rehearsal) blocked the worker's
# INSERT ... ON CONFLICT for ~25 min. So apply and reverse now run in autocommit, one committed batch of
# $BatchSize rows per statement (psql \gexec). Each batch waits at most 5s for a lock and runs at most 15s, and
# before every batch a check stops the run if any session has been waiting on a lock for over 30s. A stopped
# run is safe to re-run: it only moves rows still at their old (apply) or new (reverse) category.
# rehearse.sql runs the same batch statements on a 5,000-row sample inside BEGIN ... ROLLBACK.
# 10-14 apply: 2,000-row batches back to back wrote ~537MB of WAL in 3 min (~4.5KB/row), forcing a WAL checkpoint
# whose fsync stalled 74s and timed out batch 60. 1,000 rows + 8s pause keeps it to ~150MB per 5-min checkpoint.
# Resumed run: batch 61 still timed out with healthy checkpoints, 35s into a worker poll (heap reads competing
# with the poll's write burst on 128MB shared_buffers). 500 rows + 4s: same WAL pace, half the I/O per batch.
param([int]$BatchSize = 500, [double]$Pause = 4, [int]$Sample = 5000)
Set-Location $PSScriptRoot
$rows = @(Get-Content category-map.csv | Select-Object -Skip 1 | Where-Object { $_ })
$n = $rows.Count
$md5 = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash(
  [Text.Encoding]::ASCII.GetBytes(($rows -join "`n")))).Replace('-', '').ToLower()

$hdr = @"
-- Category backfill for publisher-language keywords as a last pass (fix b215819 + 1ed7689). category-map.csv holds
-- id,old,new for every article whose stored category equals the OLD categorizer's result (headline, publisher
-- language, URL) and whose NEW result differs ($n rows, md5 $md5 over the CSV body lines).
-- Feed-derived categories (stored <> old headline result) are not touched. MEDIUM per Get-ChangeRisk.
-- Copy category-map.csv to postgres-0:/tmp/category-map.csv first. Reverse: reverse.sql (same CSV).
-- Batched: autocommit, $BatchSize rows per committed statement (see Build-Sql.ps1). Never wrap in BEGIN.
\set ON_ERROR_STOP on
SET lock_timeout = '5s';
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
# Read-only guard, safe on a partly applied state (each row is at old or new).
$guard = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM category_map m JOIN articles a ON a.id = m.id WHERE a.category NOT IN (m.old, m.new)) THEN
    RAISE EXCEPTION 'some mapped articles have a third category value (changed since the mapping was made)'; END IF;
END `$`$;
"@
# Only rows still to move, so a resumed run does not re-walk (and re-pause over) finished batches.
function BatchAll($from) { "CREATE TEMP TABLE batch_map AS SELECT m.id, m.old, m.new, ((row_number() OVER (ORDER BY m.id)) - 1) / $BatchSize AS b FROM category_map m JOIN articles a ON a.id = m.id AND a.category = m.$from;" }
# Sample: 1,000 newest mapped ids (the ones the worker re-inserts, so the likeliest lock conflicts) + pseudo-random rest.
$batchSample = @"
CREATE TEMP TABLE batch_map AS SELECT id, old, new, ((row_number() OVER (ORDER BY id)) - 1) / $BatchSize AS b FROM (
  (SELECT * FROM category_map ORDER BY id DESC LIMIT 1000)
  UNION (SELECT * FROM category_map ORDER BY md5(id::text) LIMIT $($Sample - 1000))) s;
"@
$index = "CREATE INDEX ON batch_map (b); ANALYZE batch_map;"
$check = "DO `$w`$ BEGIN IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = ''Lock'' AND now() - query_start > interval ''30 seconds'') THEN RAISE EXCEPTION ''stopping: a session has waited on a lock for over 30s''; END IF; END `$w`$"
function Batches($set, $where, $sleep) {
@"
SET statement_timeout = '15s';
SET log_min_duration_statement = 3000;
SELECT '$check',
       format('UPDATE articles a SET category = m.$set FROM batch_map m WHERE m.b = %s AND a.id = m.id AND a.category = m.$where', b),
       'SELECT pg_sleep($sleep)'
  FROM generate_series(0, coalesce((SELECT max(b) FROM batch_map), -1)) b ORDER BY b
\gexec
RESET statement_timeout;
RESET log_min_duration_statement;
"@
}
$state = "select 'state|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) FROM category_map m LEFT JOIN articles a ON a.id = m.id;"
$sstate = "select 'sample|' || count(*) || '|' || count(*) FILTER (WHERE a.category = m.new) || '|' || count(*) FILTER (WHERE a.category = m.old) || '|' || count(*) FILTER (WHERE a.id IS NULL) || '|' || md5(string_agg(m.id || ':' || coalesce(a.category, '-'), ',' ORDER BY m.id)) FROM batch_map m LEFT JOIN articles a ON a.id = m.id;"
$fp = @"
select 'fp|' || md5(string_agg(a.id || ':' || a.category, ',' ORDER BY a.id)) FROM articles a JOIN category_map m ON m.id = a.id;
select 'dist|' || string_agg(category || '=' || n, ' ' ORDER BY category) FROM (SELECT category, count(*) n FROM articles GROUP BY category) t;
"@
$t0 = "select 'start|' || clock_timestamp();"
$t1 = "select 'end|' || clock_timestamp();"

Set-Content -Encoding ascii apply.sql    ($hdr, $load, $guard, (BatchAll 'old'), $index, $t0, (Batches 'new' 'old' $Pause), $t1, $state -join "`n")
Set-Content -Encoding ascii reverse.sql  ("-- Reverse of apply.sql: mapped articles back to their old category (only where still at the new one).", $hdr, $load, (BatchAll 'new'), $index, $t0, (Batches 'old' 'new' $Pause), $t1, $state -join "`n")
Set-Content -Encoding ascii verify.sql   ($hdr, $load, $state, $fp -join "`n")
# One short transaction over the sample only: apply batches, reverse batches, ROLLBACK.
Set-Content -Encoding ascii rehearse.sql ($hdr, $load, $guard, $state, $batchSample, $index, 'BEGIN;', $sstate, $t0,
  (Batches 'new' 'old' 0), $sstate, (Batches 'old' 'new' 0), $sstate, $t1, 'ROLLBACK;', $state -join "`n")
"built for $n rows, md5 $md5, batches of $BatchSize with ${Pause}s pauses (full set: $([math]::Ceiling($n / $BatchSize)) batches), rehearsal sample $Sample"
