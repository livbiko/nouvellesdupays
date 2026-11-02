#!/bin/bash
# Copied to ubuntu@192.168.1.51:~/onprem-set-admin-secret.sh by Set-AdminPassword-OnPrem.ps1. Reads
# {"ADMIN_PASSWORD_HASH":"<salt>:<scrypt>","ADMIN_TOKEN_SECRET":"<hex>"} on stdin and merges it into the
# on-prem nouvellesdupays-secrets. Validates the shape first; prints only kubectl's one-line result.
set -euo pipefail
json=$(cat | sed '1s/^\xEF\xBB\xBF//' | tr -d '\r\n')   # PowerShell pipes add a UTF-8 BOM and \r\n
if ! printf '%s' "$json" | grep -Eq '^\{"ADMIN_PASSWORD_HASH":"[0-9a-f]{32}:[0-9a-f]{128}","ADMIN_TOKEN_SECRET":"[0-9a-f]{64}"\}$'; then
  echo "unexpected input - nothing changed" >&2
  exit 1
fi
sudo /var/lib/rancher/rke2/bin/kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n nouvellesdupays \
  patch secret nouvellesdupays-secrets -p "{\"stringData\":$json}"
