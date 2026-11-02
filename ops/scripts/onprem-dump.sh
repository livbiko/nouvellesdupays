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
overrides=$(cat <<JSON
{"spec":{"restartPolicy":"Never","nodeName":"dr-rke2",
  "volumes":[{"name":"backups","hostPath":{"path":"$dir","type":"Directory"}}],
  "containers":[{"name":"$pod","image":"postgres:16-alpine",
    "command":["sh","-c","pg_dump -Fc -f /backups/$name.partial \"\$DATABASE_URL\" && n=\$(pg_restore -l /backups/$name.partial | grep -c 'TABLE DATA') && [ \"\$n\" -gt 10 ] && mv /backups/$name.partial /backups/$name && echo \"entries=\$n\""],
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
