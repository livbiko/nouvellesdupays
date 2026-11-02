#!/bin/bash
# Copied to ubuntu@192.168.1.51:~/onprem-dump.sh. Full pg_dump (custom format) of the ON-PREM production DB
# into ~/ndp-backups/ on dr-rke2 -- the on-prem recovery point before a data release (the OKE
# New-RecoveryPoint.ps1 cannot reach this database). The dump is made and checked (pg_restore -l) inside a
# throwaway pod, then copied out once and size-compared (streaming it back in for the check timed out, 11-02).
#   bash ~/onprem-dump.sh "<label>"
set -euo pipefail
K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"
label=$(echo "${1:-manual}" | tr -c 'a-zA-Z0-9-' '-' | cut -c1-50)
out=~/ndp-backups/onprem-$(date -u +%Y-%m-%dT%H-%M-%SZ)-$label.dump
mkdir -p ~/ndp-backups
pod="dump-onprem-$(date +%H%M%S)"
overrides='{"spec":{"restartPolicy":"Never","containers":[{"name":"'$pod'","image":"postgres:16-alpine","command":["sleep","3600"],
  "resources":{"requests":{"memory":"256Mi"},"limits":{"memory":"1Gi"}},
  "env":[{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nouvellesdupays-secrets","key":"DATABASE_URL"}}}]}]}}'
$K run "$pod" --restart=Never --image=postgres:16-alpine --overrides="$overrides" >/dev/null
trap '$K delete pod "$pod" --wait=false >/dev/null 2>&1 || true' EXIT
$K wait --for=condition=Ready "pod/$pod" --timeout=120s >/dev/null
$K exec "$pod" -- sh -c 'pg_dump -Fc -f /tmp/db.dump "$DATABASE_URL"'
entries=$($K exec "$pod" -- sh -c 'pg_restore -l /tmp/db.dump | grep -c "TABLE DATA"')
size_pod=$($K exec "$pod" -- stat -c %s /tmp/db.dump)
$K exec "$pod" -- cat /tmp/db.dump > "$out"
size_host=$(stat -c %s "$out")
[ "$size_pod" = "$size_host" ] || { echo "SIZE MISMATCH pod=$size_pod host=$size_host"; exit 1; }
[ "$entries" -gt 10 ] || { echo "dump lists only $entries table-data entries"; exit 1; }
echo "dump OK: $out ($(du -h "$out" | cut -f1), $entries table-data entries, size verified)"
