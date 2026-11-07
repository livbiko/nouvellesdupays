#!/bin/bash
# Runs rehearse.sql or apply.sql (Build #187) in a throwaway postgres pod on dr-rke2 that mounts the SQL files (~/b187)
# and the dump folder (/home/ubuntu/ndp-backups, where apply.sql writes the CSV). Waits up to 60 min.
# No delete-on-exit trap: if this SSH session drops, the pod keeps going; read it later with
#   kubectl logs <pod>  (name printed first).
#   bash ~/b187/cleanup-run.sh rehearse.sql|apply.sql
set -uo pipefail
K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"
file=$1
pod="b187-${file%.sql}-$(date +%H%M%S)"
echo "pod $pod"
overrides=$(cat <<JSON
{"spec":{"restartPolicy":"Never","nodeName":"dr-rke2",
  "volumes":[{"name":"backups","hostPath":{"path":"/home/ubuntu/ndp-backups","type":"Directory"}},
             {"name":"sql","hostPath":{"path":"/home/ubuntu/b187","type":"Directory"}}],
  "containers":[{"name":"$pod","image":"postgres:16-alpine",
    "command":["sh","-c","psql \"\$DATABASE_URL\" -X -At -F '|' -f /sql/$file 2>&1"],
    "volumeMounts":[{"name":"backups","mountPath":"/backups"},{"name":"sql","mountPath":"/sql","readOnly":true}],
    "resources":{"requests":{"memory":"128Mi"},"limits":{"memory":"512Mi"}},
    "env":[{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nouvellesdupays-secrets","key":"DATABASE_URL"}}}]}]}}
JSON
)
$K run "$pod" --restart=Never --image=postgres:16-alpine --overrides="$overrides" >/dev/null
for i in $(seq 1 1800); do
  phase=$($K get pod "$pod" -o jsonpath='{.status.phase}' 2>/dev/null)
  [ "$phase" = Succeeded ] || [ "$phase" = Failed ] && break
  sleep 2
done
$K logs "$pod"
code=$($K get pod "$pod" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null)
[ -n "$code" ] || { echo "pod still running (phase=$phase) -- left in place"; exit 9; }
$K delete pod "$pod" --wait=false >/dev/null 2>&1
exit "$code"
