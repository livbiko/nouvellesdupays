#!/bin/sh
# Cancel the detached rehearsal session (it ends in ROLLBACK anyway): it is holding row locks that block the
# worker's INSERT ... ON CONFLICT on articles.dedup_hash. Then show what is still waiting.
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select 'cancel|' || pid || '|' || pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and query like 'UPDATE articles a SET category = m.%' and pid <> pg_backend_pid()"
sleep 3
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select 'left|' || count(*) filter (where query like 'UPDATE articles a SET category%') || ' rehearsal|' || count(*) filter (where wait_event_type = 'Lock') || ' waiting on locks' from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'"
echo "--- err"; cat /tmp/rehearse-165152.err 2>/dev/null
