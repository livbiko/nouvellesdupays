#!/bin/sh
# Read-only: what the detached rehearsal psql session is doing, and its partial output.
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select pid || '|' || state || '|' || coalesce(wait_event_type || '/' || wait_event, '-') || '|' || (now() - xact_start) || '|' || left(regexp_replace(query, '\s+', ' ', 'g'), 120) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'"
echo "--- out"; cat /tmp/rehearse-165152.out 2>/dev/null
echo "--- err"; cat /tmp/rehearse-165152.err 2>/dev/null
date -u
