#!/bin/bash
# Weekly creator report (Build #246, infra/k8s/onprem-dr/creator-report-cronjob.yaml), Monday 07:10 UTC, after
# the silent-publishers report. Read-only: SELECTs only. Tells the owner what the creator agents (worker
# creator-agents.js, creator-rankings.js) did in the last 7 days and what waits for review in /admin/creators.
# Delivery as silent-report.sh: Brevo transactional API to REPORT_TO. DRY_RUN=1 prints the report, sends nothing.
# Needs psql + curl or (busybox) wget.
set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
if [ -z "${DRY_RUN:-}" ]; then
  : "${BREVO_API_KEY:?BREVO_API_KEY is required (or DRY_RUN=1)}"
  : "${REPORT_TO:?REPORT_TO is required}"
fi
: "${REPORT_FROM:=noreply@nouvellesdupays.com}"
: "${MIN_RANKED:=5}"   # apps/web/src/app/youtube/page.tsx shows the ranking from this many ranked creators

# One query, '|'-separated rows; a failed section says so instead of stopping the report.
q() { psql "$DATABASE_URL" -X -q -At -F '|' -v ON_ERROR_STOP=1 -c "SET statement_timeout = '60s'" -c "$1"; }
CLEAN="'[|[:cntrl:]]+', ' ', 'g'"
PUBLIC="cr.review_status = 'approved' AND NOT cr.possible_minor AND cr.merged_into_id IS NULL"

QUEUE=$(q "SELECT count(*), count(*) FILTER (WHERE created_at > now() - interval '7 days'),
                  coalesce(to_char(min(created_at), 'YYYY-MM-DD'), '-')
             FROM creators WHERE review_status = 'candidate' AND merged_into_id IS NULL") || QUEUE='?|?|?'
IFS='|' read -r N_QUEUE N_QUEUE_NEW OLDEST <<<"$QUEUE"

# No rejected_at column: updated_at of a rejected creator is the decision time unless it was edited later.
DECISIONS=$(q "SELECT cr.review_status, coalesce(c.name, cr.region, 'no country'), count(*)
                 FROM creators cr LEFT JOIN countries c ON c.id = cr.country_id
                WHERE (cr.review_status = 'approved' AND cr.approved_at > now() - interval '7 days')
                   OR (cr.review_status = 'rejected' AND cr.updated_at > now() - interval '7 days')
                GROUP BY 1, 2 ORDER BY 1, 3 DESC, 2" \
  | awk -F'|' 'NF>=3 {printf "- %s: %s %s\n", $1, $2, $3}') || DECISIONS='  (query failed)'

JOBS=$(q "SELECT status, count(*) FROM discovery_jobs
           WHERE agent = 'youtube' AND (status = 'queued' OR finished_at > now() - interval '7 days')
           GROUP BY 1 ORDER BY 1" | awk -F'|' 'NF>=2 {printf "%s %s, ", $2, $1}' | sed 's/, $//') || JOBS='(query failed)'
FAILED=$(q "SELECT c.name, c.iso_code, j.attempts, left(regexp_replace(coalesce(j.last_error, ''), $CLEAN), 160)
              FROM discovery_jobs j JOIN countries c ON c.id = j.country_id
             WHERE j.agent = 'youtube' AND j.status = 'failed' AND j.finished_at > now() - interval '7 days'
             ORDER BY c.name" \
  | awk -F'|' 'NF>=4 {printf "- %s (%s), %s attempt(s): %s\n", $1, $2, $3, $4}') || FAILED='  (query failed)'
QUOTA=$(q "SELECT coalesce(sum(quota_units), 0),
                  count(*) FILTER (WHERE message LIKE '%stopped: quota budget%')
             FROM agent_runs WHERE agent = 'youtube' AND started_at > now() - interval '7 days'") || QUOTA='?|?'
IFS='|' read -r UNITS QUOTA_STOPS <<<"$QUOTA"

# Public ranking = global/overall of the latest computation (apps/api/src/publicCreators.js), approved creators
# only. The change compares with the newest computation at least 7 days old, if there is one.
RANKING=$(q "WITH latest AS (SELECT max(computed_at) AS t FROM creator_rankings),
                  prev AS (SELECT max(computed_at) AS t FROM creator_rankings WHERE computed_at <= now() - interval '7 days')
             SELECT r.rank, cr.display_name, round(r.score::numeric), coalesce(c.name, cr.region, ''),
                    coalesce(p.rank::text, 'new')
               FROM creator_rankings r JOIN latest ON r.computed_at = latest.t
               JOIN creators cr ON cr.id = r.creator_id
               LEFT JOIN countries c ON c.id = cr.country_id
               LEFT JOIN prev ON true
               LEFT JOIN creator_rankings p ON p.computed_at = prev.t AND p.creator_id = r.creator_id
                                           AND p.scope = 'global' AND p.dimension = 'overall'
              WHERE r.scope = 'global' AND r.dimension = 'overall' AND $PUBLIC
              ORDER BY r.rank") || RANKING='?'
N_RANKED=$(echo -n "$RANKING" | grep -c '|' || true)
case "$RANKING" in '?') N_RANKED='?'; TOP='  (query failed)' ;;
  *) TOP=$(echo "$RANKING" | head -5 | awk -F'|' 'NF>=5 {printf "- #%s %s (%s): score %s, last week %s\n", $1, $2, $4, $3, ($5 == "new" ? "not ranked" : "#" $5)}') ;;
esac
if [ "$N_RANKED" = '?' ]; then SHOWN='unknown'
elif [ "$N_RANKED" -ge "$MIN_RANKED" ]; then SHOWN='yes'
else SHOWN="no ($N_RANKED of $MIN_RANKED ranked approved creators)"; fi

# Countries with no creator at all (any status), and those the YouTube agent has never had a job for.
GAPS=$(q "SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM creators cr WHERE cr.country_id = c.id)),
                 count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM discovery_jobs j WHERE j.agent = 'youtube' AND j.country_id = c.id)),
                 count(*)
            FROM countries c") || GAPS='?|?|?'
IFS='|' read -r N_NO_CREATOR N_NO_JOB N_COUNTRIES <<<"$GAPS"

BODY="nouvellesdupays weekly creator report ($(date -u +%Y-%m-%d), last 7 days)

REVIEW QUEUE -- /admin/creators
${N_QUEUE} creator(s) waiting for review, ${N_QUEUE_NEW} new this week, oldest since ${OLDEST}.

DECISIONS THIS WEEK
${DECISIONS:-  none}

DISCOVERY (YouTube agent)
Jobs: ${JOBS:-none} (done/failed = finished this week, queued = waiting now).
YouTube quota used: ${UNITS} units; ${QUOTA_STOPS} hourly run(s) stopped by the quota budget.
Failed this week:
${FAILED:-  none}

RANKING (public, global overall score)
${N_RANKED} ranked approved creator(s). Ranking shown on /youtube: ${SHOWN}.
${TOP:-  none}

COVERAGE
${N_NO_CREATOR} of ${N_COUNTRIES} countries have no creator yet (any status); ${N_NO_JOB} never had a YouTube discovery job.

Directory: https://nouvellesdupays.com/creators"

SUBJECT="nouvellesdupays: ${N_QUEUE} creators to review, ${N_RANKED} ranked (weekly creator report)"
echo "$BODY"

# Same JSON escaping as silent-report.sh (no jq in the image).
json_str() {
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    if (NR > 1) print "\\n"
    n = length($0)
    for (i = 1; i <= n; i++) {
      c = substr($0, i, 1)
      if (c == "\\") print "\\\\"; else if (c == "\"") print "\\\""; else if (c == "\t") print "\\t"; else if (c >= " ") print c
    }
  }'
}

if [ -n "${DRY_RUN:-}" ]; then
  echo "DRY_RUN: not sent (subject: $SUBJECT)"
  exit 0
fi
PAYLOAD="{\"sender\":{\"name\":\"NouvellesDuPays\",\"email\":\"$(json_str "$REPORT_FROM")\"},\"to\":[{\"email\":\"$(json_str "$REPORT_TO")\"}],\"subject\":\"$(json_str "$SUBJECT")\",\"textContent\":\"$(json_str "$BODY")\"}"
if command -v curl > /dev/null; then
  curl -fsS -o /dev/null -X POST https://api.brevo.com/v3/smtp/email \
    -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' --data "$PAYLOAD" && echo "report sent"
else
  wget -q -O /dev/null --header "api-key: $BREVO_API_KEY" --header 'content-type: application/json' \
    --post-data "$PAYLOAD" https://api.brevo.com/v3/smtp/email && echo "report sent"
fi
