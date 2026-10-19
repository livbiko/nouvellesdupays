-- Read-only, ~30 min after apply. Rows fetched since then should no longer sit at their fetch time, nor after it.
SELECT 'new|' || a.publisher_id || '|' || count(*) || ' new|' || count(*) FILTER (WHERE abs(extract(epoch FROM a.published_at - a.fetched_at)) < 5) || ' at fetch time|'
       || count(*) FILTER (WHERE a.published_at > a.fetched_at) || ' after fetch|newest ' || coalesce(to_char(max(a.published_at), 'HH24:MI'), '-') || ' (fetched ' || coalesce(to_char(max(a.fetched_at), 'HH24:MI'), '-') || ')'
  FROM articles a WHERE a.publisher_id IN (5207) AND a.fetched_at > now() - interval '30 minutes' GROUP BY a.publisher_id ORDER BY 1;
