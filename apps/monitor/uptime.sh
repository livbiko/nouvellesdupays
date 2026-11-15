#!/bin/sh
# On-prem uptime monitor (Build #252). Runs every 10 min from dr-rke2 and fetches the PUBLIC name, so the request goes out
# to 81.130.238.41 and back in through the BT Hub and dr-haproxy (.50): the 11-14 outage (dr-haproxy frozen) also
# failed this way from .51. Emails the owner via Brevo only on a state change: "down" after FAIL_THRESHOLD failed runs
# in a row, "recovered" on the first good run after that. State lives in a ConfigMap (STATE_CM) the job's
# ServiceAccount may get/patch. Needs curl + POSIX sh (curlimages/curl). TLS expiry stays in Test-Build.
set -u

SITE_BASE="${SITE_BASE:-https://nouvellesdupays.com}"
STATE_CM="${STATE_CM:-uptime-state}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
: "${BREVO_API_KEY:?BREVO_API_KEY is required}"
: "${REPORT_TO:?REPORT_TO is required}"
REPORT_FROM="${REPORT_FROM:-noreply@nouvellesdupays.com}"

SA=/var/run/secrets/kubernetes.io/serviceaccount
NS=$(cat "$SA/namespace")
CM_URL="https://kubernetes.default.svc/api/v1/namespaces/$NS/configmaps/$STATE_CM"
kube() { curl -fsS --cacert "$SA/ca.crt" -H "Authorization: Bearer $(cat "$SA/token")" "$@"; }

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FAILED=""
check() {
  if curl -fsS -o /dev/null -m 20 "$2"; then echo "[OK] $1"; else echo "[FAIL] $1 ($2)"; FAILED="$FAILED $1"; fi
}
check homepage "$SITE_BASE/"
check api "$SITE_BASE/api/countries"

CM=$(kube "$CM_URL") || { echo "cannot read ConfigMap $STATE_CM"; exit 1; }
field() { printf '%s' "$CM" | tr -d '\n' | sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p"; }
STATE=$(field state); STATE=${STATE:-up}
COUNT=$(field count); COUNT=${COUNT:-0}
SINCE=$(field since)

send() {
  payload=$(printf '{"sender":{"name":"NouvellesDuPays monitor","email":"%s"},"to":[{"email":"%s"}],"subject":"%s","textContent":"%s"}' \
    "$REPORT_FROM" "$REPORT_TO" "$1" "$2")
  curl -fsS -o /dev/null -X POST https://api.brevo.com/v3/smtp/email \
    -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' --data "$payload" && echo "email sent: $1"
}

if [ -z "$FAILED" ]; then
  if [ "$STATE" = down ]; then
    send "[NDP] Site back up ($SITE_BASE)" "$SITE_BASE answers again at $NOW (down since $SINCE). Checked from dr-rke2 through the public address."
  fi
  STATE=up; COUNT=0; SINCE=""
else
  COUNT=$((COUNT + 1))
  [ -z "$SINCE" ] && SINCE=$NOW
  if [ "$STATE" != down ] && [ "$COUNT" -ge "$FAIL_THRESHOLD" ]; then
    send "[NDP] Site DOWN ($SITE_BASE)" "Failed:$FAILED - $COUNT checks in a row since $SINCE (every 10 min, from dr-rke2 through the public address 81.130.238.41 -> BT Hub -> dr-haproxy .50). First checks: dr-haproxy (.50) answers on 8443? IIS on BikoDC? You get one more email when it recovers."
    STATE=down
  fi
fi

kube -X PATCH -H 'Content-Type: application/merge-patch+json' \
  --data "{\"data\":{\"state\":\"$STATE\",\"count\":\"$COUNT\",\"since\":\"$SINCE\",\"last_run\":\"$NOW\",\"last_failed\":\"$FAILED\"}}" \
  "$CM_URL" > /dev/null || { echo "cannot update ConfigMap $STATE_CM"; exit 1; }
echo "state=$STATE count=$COUNT"
