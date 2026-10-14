#!/bin/sh
# Read-only: every 1s for ~15 min, wait events of active sessions (to catch what a stalled backfill batch waits on).
q() { psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"; }
i=0; while [ $i -lt 900 ]; do
  q "select to_char(clock_timestamp(), 'HH24:MI:SS') || '|' || string_agg(coalesce(nullif(application_name, ''), '?') || ':' || coalesce(wait_event_type || '/' || wait_event, 'cpu') || ':' || extract(epoch from clock_timestamp() - query_start)::numeric(6,1), ' ' order by application_name) from pg_stat_activity where datname = current_database() and state = 'active' and pid <> pg_backend_pid()"
  sleep 1; i=$((i+1)); done
