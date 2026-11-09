#!/bin/bash
# Copied to ubuntu@192.168.1.51:~/onprem-dump.sh. Full pg_dump (custom format) of the ON-PREM production DB
# into /home/ubuntu/ndp-backups/ on dr-rke2 -- the on-prem recovery point before a release (the OKE path of
# New-RecoveryPoint.ps1 cannot reach this database).
# The throwaway postgres pod mounts that directory as a hostPath (dr-rke2 is a single-node cluster) and
# writes the dump straight to disk, then checks it with pg_restore -l. Nothing is streamed through
# `kubectl exec`: on 2026-11-02 copying a 900 MB dump out that way arrived truncated (893 of 903 MB).
#   bash ~/onprem-dump.sh "<label>"
set -euo pipefail
K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"
dir=/home/ubuntu/ndp-backups
label=$(printf '%s' "${1:-manual}" | tr -c 'a-zA-Z0-9-' '-' | cut -c1-50 | sed 's/-*$//')
name=onprem-$(date -u +%Y-%m-%dT%H-%M-%SZ)-$label.dump
mkdir -p "$dir"
pod="dump-onprem-$(date +%H%M%S)"
# A connection string on pg_dump's command line is readable by any process on the node (`ps`), password included
# (seen 2026-11-08). Inside the pod the password moves to PGPASSWORD (environ is root-only) using shell built-ins
# only, so no command line ever holds it; percent-encoded credentials are refused rather than guessed. u always
# ends in '?' or '&' so options can be appended. The keepalives make a dropped connection fail the dump in
# ~90 s -- on 2026-11-08 a 2-minute network outage left pg_dump hung on a dead socket for 15 min.
split='rest=${DATABASE_URL#*://}; cred=${rest%%@*}; case $cred in *:*) ;; *) echo DATABASE_URL has no password part; exit 3;; esac; case $cred in *%*|*/*) echo DATABASE_URL credentials are percent-encoded - not supported; exit 3;; esac; export PGPASSWORD=${cred#*:}; u=\"${DATABASE_URL%%://*}://${cred%%:*}@${rest#*@}\"; case $u in *[?]*) u=\"$u&\";; *) u=\"$u?\";; esac;'
overrides=$(cat <<JSON
{"spec":{"restartPolicy":"Never","nodeName":"dr-rke2",
  "volumes":[{"name":"backups","hostPath":{"path":"$dir","type":"Directory"}}],
  "containers":[{"name":"$pod","image":"postgres:16-alpine",
    "command":["sh","-c","$split u=\"\${u}keepalives_idle=30&keepalives_interval=10&keepalives_count=6\"; pg_dump -Fc -f /backups/$name.partial \"\$u\" && n=\$(pg_restore -l /backups/$name.partial | grep -c 'TABLE DATA') && [ \"\$n\" -gt 10 ] && mv /backups/$name.partial /backups/$name && echo \"entries=\$n\""],
    "volumeMounts":[{"name":"backups","mountPath":"/backups"}],
    "resources":{"requests":{"memory":"256Mi"},"limits":{"memory":"1Gi"}},
    "env":[{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nouvellesdupays-secrets","key":"DATABASE_URL"}}}]}]}}
JSON
)
$K run "$pod" --restart=Never --image=postgres:16-alpine --overrides="$overrides" >/dev/null
trap '$K delete pod "$pod" --wait=false >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 450); do      # up to 15 min
  phase=$($K get pod "$pod" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  [ "$phase" = Succeeded ] || [ "$phase" = Failed ] && break
  sleep 2
done
log=$($K logs "$pod" 2>&1 || true)
if [ "$phase" != Succeeded ] || [ ! -s "$dir/$name" ]; then
  sudo rm -f "$dir/$name.partial"
  echo "dump FAILED (phase=$phase): $log"
  exit 1
fi
sudo chown ubuntu:ubuntu "$dir/$name"
echo "dump OK: $dir/$name ($(du -h "$dir/$name" | cut -f1), ${log#entries=} table-data entries, pg_restore -l checked on disk)"
