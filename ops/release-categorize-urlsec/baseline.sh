#!/bin/sh
# Read-only: lock waiters every 3s for ~3 min (normal background level, before the watched rehearsal).
q() { psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"; }
i=0; while [ $i -lt 60 ]; do
  q "select to_char(now(), 'HH24:MI:SS') || '|' || count(*) filter (where wait_event_type = 'Lock') || '|' || coalesce(max(extract(epoch from now() - query_start)) filter (where wait_event_type = 'Lock'), 0)::numeric(6,1) || '|active ' || count(*) filter (where state = 'active' and pid <> pg_backend_pid()) from pg_stat_activity where datname = current_database()"
  sleep 3; i=$((i+1)); done
