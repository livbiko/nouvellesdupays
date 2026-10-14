#!/bin/sh
# Read-only: why did a batch exceed 15s around 18:15 UTC?
q() { psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"; }
echo "--- activity"; q "select pid || '|' || coalesce(application_name,'') || '|' || state || '|' || coalesce(wait_event_type || '/' || wait_event, '-') || '|' || coalesce((now() - xact_start)::text, '-') || '|' || left(regexp_replace(query, '\s+', ' ', 'g'), 100) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'"
echo "--- vacuum"; q "select p.pid || '|' || c.relname || '|' || p.phase || '|' || p.heap_blks_scanned || '/' || p.heap_blks_total from pg_stat_progress_vacuum p join pg_class c on c.oid = p.relid"
echo "--- articles stats"; q "select n_live_tup || '|dead ' || n_dead_tup || '|upd ' || n_tup_upd || '|hot ' || n_tup_hot_upd || '|autovac ' || coalesce(last_autovacuum::text, '-') || '|autoanalyze ' || coalesce(last_autoanalyze::text, '-') from pg_stat_user_tables where relname = 'articles'"
echo "--- triggers"; q "select tgname || '|' || pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'articles'::regclass and not tgisinternal"
echo "--- indexes on category"; q "select indexname || '|' || indexdef from pg_indexes where tablename = 'articles' and indexdef ilike '%category%'"
echo "--- checkpoints"; q "select * from pg_stat_checkpointer" 2>/dev/null || q "select checkpoints_timed || '|' || checkpoints_req from pg_stat_bgwriter"
echo "--- log"; d=$(q "show data_directory"); ls -t $d/log/ 2>/dev/null | head -2; f=$(ls -t $d/log/* 2>/dev/null | head -1); [ -n "$f" ] && grep -n "18:1[2-7]" "$f" | grep -iv "connection" | tail -25
