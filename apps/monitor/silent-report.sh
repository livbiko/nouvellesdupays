#!/bin/bash
# Weekly "silent publishers" report (infra/k8s/17-silent-report-cronjob.yaml).
# On 2026-10-17 a manual sweep (ops/investigate-stale/stale.sql) found 63 of
# 600 active publishers with no article for 14+ days -- 11 of them showed a
# green "OK" for weeks to years because their feeds answered but were frozen,
# cached or undated. The admin "Silencieux" filter (Build #84) shows them to
# anyone who looks; this sends the same list by email once a week, through the
# same OCI Notifications topic as monitor.sh (instance principal, no stored
# credential). Read-only: one SELECT, nothing is written.
set -uo pipefail

: "${TOPIC_ID:?TOPIC_ID is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SILENT_DAYS:=14}"

# Newest *dated* article per publisher, read from idx_articles_publisher_published (one index probe each).
# The first version aggregated fetched_at over 120 days; articles has no fetched_at index, so with 2M+ rows
# it hit the 60 s timeout (10-18 preview) and the report would not have been sent. Undated rows are hidden
# on the site anyway, so a publisher with only undated articles is reported as silent ("never"). Dates more
# than a day ahead (bad time zones) are ignored so they cannot mask a silent feed.
QUERY="
WITH last AS (
  SELECT p.id AS publisher_id, a.published_at AS last_fetch
    FROM publishers p
    LEFT JOIN LATERAL (SELECT published_at FROM articles
                        WHERE publisher_id = p.id AND published_at IS NOT NULL
                          AND published_at < now() + interval '1 day'
                        ORDER BY published_at DESC LIMIT 1) a ON true
   WHERE p.feed_status = 'active'),
src AS (
  SELECT DISTINCT ON (publisher_id) publisher_id, consecutive_failures, last_error
    FROM feeds WHERE enabled ORDER BY publisher_id, last_success_at DESC NULLS LAST)
SELECT CASE WHEN coalesce(s.consecutive_failures, 0) > 0 THEN 'failing' ELSE 'silent' END,
       p.id, p.name, c.iso_code,
       coalesce(to_char(l.last_fetch, 'YYYY-MM-DD'), 'never (no dated article)'),
       coalesce(left(s.last_error, 50), '')
  FROM publishers p
  JOIN countries c ON c.id = p.country_id
  JOIN last l ON l.publisher_id = p.id
  LEFT JOIN src s ON s.publisher_id = p.id
 WHERE (l.last_fetch IS NULL OR l.last_fetch < now() - interval '${SILENT_DAYS} days')
 ORDER BY 1 DESC, l.last_fetch DESC NULLS LAST, p.name;"

ROWS=$(psql "$DATABASE_URL" -X -At -F '|' -v ON_ERROR_STOP=1 -c "SET statement_timeout = '60s'" -c "$QUERY") || {
  echo "query failed"; exit 1; }
ACTIVE=$(psql "$DATABASE_URL" -X -At -c "SELECT count(*) FROM publishers WHERE feed_status = 'active'") || ACTIVE='?'

# Countries whose active publishers together have no dated article for ${COUNTRY_DAYS}+ days (or that have none).
# The publisher list above misses this: on 2026-10-19 Myanmar's only source had been dormant since 2023 and
# Lebanon/Kuwait/Oman/Bahrain relied on RFI tags that post every few months. Best effort: a failure here does
# not stop the report.
: "${COUNTRY_DAYS:=7}"
COUNTRY_QUERY="
WITH pub AS (
  SELECT p.id, p.country_id, a.published_at AS last_pub
    FROM publishers p
    LEFT JOIN LATERAL (SELECT published_at FROM articles
                        WHERE publisher_id = p.id AND published_at IS NOT NULL
                          AND published_at < now() + interval '1 day'
                        ORDER BY published_at DESC LIMIT 1) a ON true
   WHERE p.feed_status = 'active')
SELECT c.name, c.iso_code, count(pub.id), coalesce(to_char(max(pub.last_pub), 'YYYY-MM-DD'), 'never')
  FROM countries c LEFT JOIN pub ON pub.country_id = c.id
 GROUP BY c.name, c.iso_code
HAVING max(pub.last_pub) IS NULL OR max(pub.last_pub) < now() - interval '${COUNTRY_DAYS} days'
 ORDER BY max(pub.last_pub) NULLS FIRST, c.name;"
COUNTRY_ROWS=$(psql "$DATABASE_URL" -X -At -F '|' -v ON_ERROR_STOP=1 -c "SET statement_timeout = '60s'" -c "$COUNTRY_QUERY") \
  && COUNTRIES=$(echo "$COUNTRY_ROWS" | awk -F'|' 'NF>=4 {printf "- %s (%s): %s active publisher(s), newest article %s\n", $1, $2, $3, $4}') \
  || COUNTRIES="  (country query failed)"
N_COUNTRIES=$(echo -n "$COUNTRIES" | grep -c '^- ' || true)
case "$COUNTRIES" in *"query failed"*) N_COUNTRIES='?' ;; esac

SILENT=$(echo "$ROWS" | awk -F'|' '$1=="silent"' | awk -F'|' '{printf "- %s (%s, #%s): last article %s\n", $3, $4, $2, $5}')
FAILING=$(echo "$ROWS" | awk -F'|' '$1=="failing"' | awk -F'|' '{printf "- %s (%s, #%s): last article %s -- %s\n", $3, $4, $2, $5, $6}')
N_SILENT=$(echo -n "$SILENT" | grep -c '^- ' || true)
N_FAILING=$(echo -n "$FAILING" | grep -c '^- ' || true)

BODY="nouvellesdupays weekly silent-publishers report ($(date -u +%Y-%m-%d))
${N_SILENT} silent + ${N_FAILING} failing, of ${ACTIVE} active publishers, with no article for ${SILENT_DAYS}+ days.
${N_COUNTRIES} countries with no news for ${COUNTRY_DAYS}+ days.

COUNTRIES WITHOUT NEWS -- no active publisher has a dated article for ${COUNTRY_DAYS}+ days (readers see nothing new):
${COUNTRIES:-  none}

SILENT -- fetched fine but no article (frozen or cached feed, missing dates, or the site stopped publishing):
${SILENT:-  none}

FAILING -- the fetch itself fails (bot blocking, dead domain, server errors):
${FAILING:-  none}

Admin view: https://nouvellesdupays.com/admin/publishers (filters \"Silencieux\" and \"En erreur\").
Full read-only sweep: ops/investigate-stale/Look.ps1."

echo "$BODY"
oci --auth instance_principal ons message publish \
  --topic-id "$TOPIC_ID" \
  --title "nouvellesdupays: ${N_COUNTRIES} countries without news, ${N_SILENT} silent + ${N_FAILING} failing publishers (weekly)" \
  --body "$BODY" \
  --message-type RAW_TEXT > /dev/null && echo "report sent"
