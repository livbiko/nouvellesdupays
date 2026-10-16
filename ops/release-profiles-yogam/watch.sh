#!/bin/sh
# Poll + watchdog for a batched run started by Sql.ps1 -Watch (psql with application_name=ndp-backfill).
# Backstop to the in-SQL check: if any session has waited on a lock for over 30s, cancel the backfill session
# (ON_ERROR_STOP ends psql; committed batches stay, an open rehearsal transaction rolls back).
# Usage: sh /tmp/watch.sh <tag>   -> one progress line, then the run's stderr
tag=$1
q() { psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"; }
w=$(q "select count(*) || '|' || coalesce(max(extract(epoch from now() - query_start))::int, 0) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'")
if [ "${w%%|*}" != "0" ] && [ "${w##*|}" -gt 30 ]; then
  c=$(q "select count(pg_cancel_backend(pid)) from pg_stat_activity where application_name = 'ndp-backfill'")
  echo "WATCHDOG: lock waiters $w (count|oldest s) - cancelled $c backfill session(s)" | tee -a /tmp/$tag.err
fi
echo "progress|batches $(grep -c '^UPDATE' /tmp/$tag.out 2>/dev/null)|rows $(awk '/^UPDATE/ {s += $2} END {print s + 0}' /tmp/$tag.out 2>/dev/null)|lock waiters $w"
cat /tmp/$tag.err
