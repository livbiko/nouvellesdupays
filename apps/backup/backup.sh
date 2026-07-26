#!/bin/bash
# Daily logical backup: pg_dump -> gzip -> OCI Object Storage.
#
# Auth is instance_principal (the OKE node's own OCI identity, via IMDS) --
# no static credential stored anywhere. Requires the node to be in the
# `tekeche-oke-nodes-dg` dynamic group, which it already is (reused from the
# existing OCIR pull-secret-refresh setup), plus the
# `nouvellesdupays-backup-bucket-policy` IAM policy scoping that dynamic
# group to just this one bucket.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
FILENAME="nouvellesdupays-${TIMESTAMP}.sql.gz"
TMPFILE="/tmp/${FILENAME}"

echo "[backup] Starting: ${FILENAME}"
pg_dump "${DATABASE_URL}" | gzip > "${TMPFILE}"

SIZE=$(stat -c%s "${TMPFILE}")
echo "[backup] Dump complete: ${SIZE} bytes"

oci --auth instance_principal os object put \
  --bucket-name "${BACKUP_BUCKET}" \
  --file "${TMPFILE}" \
  --name "${FILENAME}" \
  --force

echo "[backup] Uploaded ${FILENAME} to bucket ${BACKUP_BUCKET}"
rm -f "${TMPFILE}"
echo "[backup] Done."
