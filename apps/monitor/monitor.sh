#!/bin/bash
# Runs inside the cluster (no Bastion tunnel needed -- that's the whole
# point: this project's own maintenance history shows the tunnel from this
# Windows box routinely expires or is simply not up, which would make an
# external-only monitor blind exactly when something breaks). kubectl
# auto-detects in-cluster config from the mounted ServiceAccount token.
# Mirrors ops/scripts/Test-Build.ps1's exact check set and thresholds, so
# "known good" here means the same thing it means everywhere else in this
# project.
set -uo pipefail  # no -e: a single check failing shouldn't stop the rest

: "${TOPIC_ID:?TOPIC_ID is required}"
: "${K8S_NS:=nouvellesdupays}"
: "${SITE_BASE:=https://nouvellesdupays.com}"

FAILURES=()
NOW_EPOCH=$(date +%s)

fail() {
  echo "[FAIL] $1"
  FAILURES+=("$1")
}
ok() {
  echo "[OK] $1"
}

# 1. Public homepage
if curl -sf -o /dev/null -m 15 "${SITE_BASE}/"; then
  ok "public homepage returns 200"
else
  fail "public homepage did not return 200"
fi

# 2. Public API returns countries
API_BODY=$(curl -sf -m 15 "${SITE_BASE}/api/countries" || echo "")
COUNTRY_COUNT=$(echo "$API_BODY" | grep -o '"iso_code"' | wc -l | tr -d ' ')
if [ "${COUNTRY_COUNT:-0}" -ge 5 ] 2>/dev/null; then
  ok "public API returns >=5 countries (got ${COUNTRY_COUNT})"
else
  fail "public API returned only ${COUNTRY_COUNT:-0} countries"
fi

# 3. TLS certificate not expiring within 14 days
EXPIRY_RAW=$(echo | openssl s_client -connect nouvellesdupays.com:443 -servername nouvellesdupays.com 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$EXPIRY_RAW" ]; then
  EXPIRY_EPOCH=$(date -d "$EXPIRY_RAW" +%s 2>/dev/null || echo 0)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  if [ "$DAYS_LEFT" -ge 14 ]; then
    ok "TLS cert valid, ${DAYS_LEFT} days left"
  else
    fail "TLS cert expires in ${DAYS_LEFT} days"
  fi
else
  fail "could not read TLS certificate expiry"
fi

# 4. api/web deployments available
API_READY=$(kubectl get deployment nouvellesdupays-api -n "$K8S_NS" -o jsonpath='{.status.availableReplicas}' 2>/dev/null)
WEB_READY=$(kubectl get deployment nouvellesdupays-web -n "$K8S_NS" -o jsonpath='{.status.availableReplicas}' 2>/dev/null)
if [ "${API_READY:-0}" -ge 1 ] 2>/dev/null && [ "${WEB_READY:-0}" -ge 1 ] 2>/dev/null; then
  ok "api/web deployments available (api=${API_READY} web=${WEB_READY})"
else
  fail "api/web deployments not fully available (api=${API_READY:-0} web=${WEB_READY:-0})"
fi

# 5. Postgres pod running
PG_PHASE=$(kubectl get pod postgres-0 -n "$K8S_NS" -o jsonpath='{.status.phase}' 2>/dev/null)
if [ "$PG_PHASE" = "Running" ]; then
  ok "postgres pod running"
else
  fail "postgres pod not running (phase=${PG_PHASE:-unknown})"
fi

# 6. Worker CronJob ran recently and succeeded. Filtered by ownerReferences
# (not a name prefix) so ad-hoc `kubectl create job --from=cronjob/...` runs
# -- used routinely during deploys in this project -- don't get mistaken for
# a real scheduled run, since those don't get an ownerReference back to the
# CronJob the way genuinely scheduled runs do.
LATEST_WORKER_JOB=$(kubectl get job -n "$K8S_NS" -o json 2>/dev/null | \
  jq -c '[.items[] | select(.metadata.ownerReferences[]?.name == "nouvellesdupays-worker")] | sort_by(.metadata.creationTimestamp) | last')
if [ -n "$LATEST_WORKER_JOB" ] && [ "$LATEST_WORKER_JOB" != "null" ]; then
  CREATED=$(echo "$LATEST_WORKER_JOB" | jq -r '.metadata.creationTimestamp')
  SUCCEEDED=$(echo "$LATEST_WORKER_JOB" | jq -r '.status.succeeded // 0')
  CREATED_EPOCH=$(date -d "$CREATED" +%s 2>/dev/null || echo 0)
  AGE_MIN=$(( (NOW_EPOCH - CREATED_EPOCH) / 60 ))
  if [ "$AGE_MIN" -lt 20 ] && [ "$SUCCEEDED" = "1" ]; then
    ok "worker ran recently and succeeded (${AGE_MIN}m ago)"
  else
    fail "worker not healthy (last scheduled run ${AGE_MIN}m ago, succeeded=${SUCCEEDED})"
  fi
else
  fail "no scheduled worker job found"
fi

# 7. No pods in CrashLoopBackOff
CRASHING=$(kubectl get pods -n "$K8S_NS" -o json 2>/dev/null | \
  jq '[.items[] | select(.status.containerStatuses[]?.state.waiting.reason == "CrashLoopBackOff")] | length')
if [ "${CRASHING:-0}" = "0" ]; then
  ok "no pods in CrashLoopBackOff"
else
  fail "${CRASHING} pod(s) in CrashLoopBackOff"
fi

# Alert if anything failed
if [ ${#FAILURES[@]} -gt 0 ]; then
  BODY="nouvellesdupays health check failed ($(date -u +%Y-%m-%dT%H:%M:%SZ)):
$(printf -- '- %s\n' "${FAILURES[@]}")"
  echo ""
  echo "Sending alert for ${#FAILURES[@]} failure(s)..."
  oci --auth instance_principal ons message publish \
    --topic-id "$TOPIC_ID" \
    --title "nouvellesdupays: health check failed (${#FAILURES[@]} issue(s))" \
    --body "$BODY" \
    --message-type RAW_TEXT
  echo "Alert sent."
  exit 1
fi

echo ""
echo "All checks passed."
