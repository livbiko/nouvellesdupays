#!/bin/bash
# Copied to ubuntu@192.168.1.51:~/onprem-psql.sh by Sql-OnPrem.ps1. Reads BASE64-ENCODED SQL on stdin and runs it with psql
# in a throwaway postgres:16-alpine pod that takes DATABASE_URL from nouvellesdupays-secrets (on-prem production).
# The SQL travels base64-encoded in an env var and the result is read from the pod log (an interactive
# `kubectl run -i` lost all output on 2026-11-02). Exit code = psql's.
set -uo pipefail
K="sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays"
pod="sql-onprem-$(date +%H%M%S)-$RANDOM"
# Callers send the SQL already base64-encoded (UTF-8 bytes). Windows PowerShell 5.1 re-encodes text it pipes to
# native programs as ASCII, so accents arrived as '?' (Builds #131/#132 profiles, 2026-11-02); base64 is pure
# ASCII and survives. Anything else PowerShell adds (BOM, CRLF) is dropped here.
sql_b64=$(tr -dc 'A-Za-z0-9+/=')
# Keeps the password off psql's command line, which any process on the node can read (`ps`): see onprem-dump.sh.
split='rest=${DATABASE_URL#*://}; cred=${rest%%@*}; case $cred in *:*) ;; *) echo DATABASE_URL has no password part; exit 3;; esac; case $cred in *%*|*/*) echo DATABASE_URL credentials are percent-encoded - not supported; exit 3;; esac; export PGPASSWORD=${cred#*:}; u=\"${DATABASE_URL%%://*}://${cred%%:*}@${rest#*@}\"; case $u in *[?]*) u=\"$u&\";; *) u=\"$u?\";; esac;'
overrides=$(cat <<JSON
{"spec":{"restartPolicy":"Never","containers":[{"name":"$pod","image":"postgres:16-alpine",
  "command":["sh","-c","$split u=\"\${u}connect_timeout=10\"; echo \"\$SQL_B64\" | base64 -d | psql \"\$u\" -X -v ON_ERROR_STOP=1 -At -F '|' -f - 2>&1"],
  "env":[{"name":"SQL_B64","value":"$sql_b64"},
         {"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nouvellesdupays-secrets","key":"DATABASE_URL"}}}]}]}}
JSON
)
$K run "$pod" --restart=Never --image=postgres:16-alpine --overrides="$overrides" >/dev/null
for i in $(seq 1 180); do
  phase=$($K get pod "$pod" -o jsonpath='{.status.phase}' 2>/dev/null)
  [ "$phase" = Succeeded ] || [ "$phase" = Failed ] && break
  sleep 2
done
$K logs "$pod"
code=$($K get pod "$pod" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null)
$K delete pod "$pod" --wait=false >/dev/null 2>&1
[ -n "$code" ] || { echo "pod did not finish (phase=$phase)"; exit 9; }
exit "$code"
