#!/bin/sh
# On-prem uptime monitor (Build #252; CR-2026-11-19-03: every 2 min, every public hostname). Runs from dr-rke2 and
# fetches the PUBLIC names, so the requests go out to 81.130.238.41 and back in through the BT Hub (and dr-haproxy .50
# while the Hub forwards there): the 11-14/16/19 outages (dr-haproxy frozen) failed this way from .51. Emails the owner via Brevo only on a state change: "down" after FAIL_THRESHOLD failed runs
# in a row, "recovered" on the first good run after that. State lives in a ConfigMap (STATE_CM) the job's
# ServiceAccount may get/patch. Needs curl + POSIX sh (curlimages/curl). TLS expiry stays in Test-Build.
set -u

SITE_BASE="${SITE_BASE:-https://nouvellesdupays.com}"
STATE_CM="${STATE_CM:-uptime-state}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
: "${BREVO_API_KEY:?BREVO_API_KEY is required}"
: "${REPORT_TO:?REPORT_TO is required}"
REPORT_FROM="${REPORT_FROM:-noreply@nouvellesdupays.com}"
# The other public sites behind the same Hub address: "name=url" pairs, space separated.
EXTRA_CHECKS="${EXTRA_CHECKS-tekeche-api=https://api.tekeche.com/health tekeche=https://tekeche.com/ livbiko=https://livbiko.com/ 225woyo=https://225woyo.com/ kendebabi=https://kendebabi.com/}"

SA=/var/run/secrets/kubernetes.io/serviceaccount
NS=$(cat "$SA/namespace")
CM_URL="https://kubernetes.default.svc/api/v1/namespaces/$NS/configmaps/$STATE_CM"
kube() { curl -fsS --cacert "$SA/ca.crt" -H "Authorization: Bearer $(cat "$SA/token")" "$@"; }

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FAILED=""
check() {
  if curl -fsS -o /dev/null -m 15 "$2"; then echo "[OK] $1"; else echo "[FAIL] $1 ($2)"; FAILED="$FAILED $1"; fi
}
check homepage "$SITE_BASE/"
check api "$SITE_BASE/api/countries"
for pair in $EXTRA_CHECKS; do check "${pair%%=*}" "${pair#*=}"; done

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
    send "[NDP] Sites back up" "All public sites answer again at $NOW (down since $SINCE). Checked from dr-rke2 through the public address."
  fi
  STATE=up; COUNT=0; SINCE=""
else
  COUNT=$((COUNT + 1))
  [ -z "$SINCE" ] && SINCE=$NOW
  if [ "$STATE" != down ] && [ "$COUNT" -ge "$FAIL_THRESHOLD" ]; then
    send "[NDP] Site DOWN:$FAILED" "Failed:$FAILED - $COUNT checks in a row since $SINCE (every 2 min, from dr-rke2 through the public address 81.130.238.41 -> BT Hub -> dr-haproxy .50). First checks: dr-haproxy (.50) answers on 8443? IIS on BikoDC? You get one more email when it recovers."
    STATE=down
  fi
fi

kube -X PATCH -H 'Content-Type: application/merge-patch+json' \
  --data "{\"data\":{\"state\":\"$STATE\",\"count\":\"$COUNT\",\"since\":\"$SINCE\",\"last_run\":\"$NOW\",\"last_failed\":\"$FAILED\"}}" \
  "$CM_URL" > /dev/null || { echo "cannot update ConfigMap $STATE_CM"; exit 1; }
echo "state=$STATE count=$COUNT"
