#!/bin/bash
# Copied to ubuntu@192.168.1.51:~/onprem-restore.sh by Invoke-Rollback.ps1. Restores one of onprem-dump.sh's dumps
# (/home/ubuntu/ndp-backups on dr-rke2) into the ON-PREM production DB, inside a throwaway postgres pod that mounts
# that directory -- the dump never leaves the node.
#   bash ~/onprem-restore.sh <dump file name>                  # PRODUCTION restore
#   bash ~/onprem-restore.sh <dump file name> --scratch-test   # same restore command, into a scratch Postgres
#                                                              # started inside the pod; production is not touched
# The restore runs in ONE transaction (--single-transaction --exit-on-error): if anything fails the database is
# left exactly as it was. It replaces all data with the dump's, so everything ingested after the dump is lost --
# a build's own reverse.sql is the first choice; this is for when that is not enough.
# The dump contains the public schema itself (owned by the app role); it is left out of the restore list, or
# --clean would try to drop the schema. A table created after the dump that references a restored table blocks
# the drop -- the transaction then aborts, nothing changes, and that table has to be dropped first.
set -euo pipefail
K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"
dir=/home/ubuntu/ndp-backups
name=${1:-}
mode=${2:-production}
case $name in onprem-*.dump) ;; *) echo "usage: onprem-restore.sh onprem-<...>.dump [--scratch-test]"; exit 2;; esac
case $name in */*|*..*) echo "dump name must be a plain file name"; exit 2;; esac
[ -s "$dir/$name" ] || { echo "no such dump: $dir/$name"; exit 2; }
case $mode in production|--scratch-test) ;; *) echo "unknown mode $mode"; exit 2;; esac
pod="restore-onprem-$(date +%H%M%S)"

# Password into PGPASSWORD, never onto a command line (same as onprem-dump.sh / onprem-psql.sh).
split='rest=${DATABASE_URL#*://}; cred=${rest%%@*}; case $cred in *:*) ;; *) echo DATABASE_URL has no password part; exit 3;; esac; case $cred in *%*|*/*) echo DATABASE_URL credentials are percent-encoded - not supported; exit 3;; esac; export PGPASSWORD=${cred#*:}; u=\"${DATABASE_URL%%://*}://${cred%%:*}@${rest#*@}\"; case $u in *[?]*) u=\"$u&\";; *) u=\"$u?\";; esac;'
restore="pg_restore -l /backups/$name | grep -v ' SCHEMA - public ' > /tmp/list; pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error -L /tmp/list -d \\\"\${u}connect_timeout=10\\\" /backups/$name"
counts="psql \\\"\${u}connect_timeout=10\\\" -X -At -c \\\"SELECT string_agg(format('SELECT %L AS t, count(*) FROM %I', tablename, tablename), ' UNION ALL ' ORDER BY tablename) FROM pg_tables WHERE schemaname='public'\\\" > /tmp/q; psql \\\"\${u}connect_timeout=10\\\" -X -At -F ' ' -f /tmp/q"

if [ "$mode" = --scratch-test ]; then
  # Local Postgres in the pod; the app role owns the database and schema and the restore runs AS that role, so
  # privilege problems a non-superuser would hit in production show up here too. Restored twice: the second run
  # exercises --clean over a populated database, which is the real rollback case.
  scratch='export PGDATA=/scratch/pg; mkdir -p $PGDATA; chown postgres $PGDATA; su-exec postgres initdb -U postgres -A trust >/dev/null; su-exec postgres pg_ctl -w -l /scratch/log -o \"-c listen_addresses=127.0.0.1 -c fsync=off -c max_wal_size=4GB\" start >/dev/null; psql -h 127.0.0.1 -U postgres -X -q -c \"CREATE ROLE nouvellesdupays LOGIN PASSWORD '"'"'scratch'"'"'\" -c \"CREATE DATABASE nouvellesdupays OWNER nouvellesdupays\"; psql -h 127.0.0.1 -U postgres -X -q -d nouvellesdupays -c \"ALTER SCHEMA public OWNER TO nouvellesdupays\"; export DATABASE_URL=postgresql://nouvellesdupays:scratch@127.0.0.1:5432/nouvellesdupays;'
  cmd="$scratch $split for run in 1 2; do s=\$(date +%s); $restore || { echo restore run \$run FAILED; exit 1; }; echo restore run \$run OK in \$((\$(date +%s)-s)) s; done; echo counts:; $counts"
  env='[]'
  volumes='{"name":"scratch","emptyDir":{}}'
  mounts=',{"name":"scratch","mountPath":"/scratch"}'
  limit=2Gi
else
  cmd="$split s=\$(date +%s); $restore && echo restore OK in \$((\$(date +%s)-s)) s && echo counts: && { $counts; }"
  env='[{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nouvellesdupays-secrets","key":"DATABASE_URL"}}}]'
  volumes=''
  mounts=''
  limit=1Gi
  # Stop everything that writes on a schedule, wait for running jobs, and put the schedules back on exit.
  suspended=""
  resume() { for c in $suspended; do $K patch cronjob "$c" -p '{"spec":{"suspend":false}}' >/dev/null && echo "resumed cronjob $c"; done; }
  trap resume EXIT
  for c in $($K get cronjob -o jsonpath='{range .items[?(@.spec.suspend==false)]}{.metadata.name}{"\n"}{end}' | grep '^nouvellesdupays-'); do
    $K patch cronjob "$c" -p '{"spec":{"suspend":true}}' >/dev/null && suspended="$suspended $c" && echo "suspended cronjob $c"
  done
  for i in $(seq 1 72); do        # up to 6 min (the worker's own deadline is 280 s)
    active=$($K get jobs -o jsonpath='{range .items[?(@.status.active)]}{.metadata.name}{" "}{end}' | tr ' ' '\n' | grep '^nouvellesdupays-' || true)
    [ -z "$active" ] && break
    sleep 5
  done
  [ -z "$active" ] || { echo "jobs still running after 6 min, restore NOT started: $active"; exit 4; }
fi

overrides=$(cat <<JSON
{"spec":{"restartPolicy":"Never","nodeName":"dr-rke2",
  "volumes":[{"name":"backups","hostPath":{"path":"$dir","type":"Directory"}}${volumes:+,$volumes}],
  "containers":[{"name":"$pod","image":"postgres:16-alpine",
    "command":["sh","-c","$cmd"],
    "volumeMounts":[{"name":"backups","mountPath":"/backups","readOnly":true}$mounts],
    "resources":{"requests":{"memory":"256Mi"},"limits":{"memory":"$limit"}},
    "env":$env}]}}
JSON
)
echo "restoring $name ($mode) in pod $pod"
$K run "$pod" --restart=Never --image=postgres:16-alpine --overrides="$overrides" >/dev/null
for i in $(seq 1 1800); do      # up to 60 min
  phase=$($K get pod "$pod" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  [ "$phase" = Succeeded ] || [ "$phase" = Failed ] && break
  sleep 2
done
$K logs "$pod" 2>&1 | tail -60 || true
$K delete pod "$pod" --wait=false >/dev/null 2>&1 || true
[ "$phase" = Succeeded ] || { echo "restore FAILED (phase=$phase)"; exit 1; }
echo "restore finished ($mode)"
