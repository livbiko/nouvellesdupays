WITH cov AS (
  SELECT p.country_id, count(*)::int AS active,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM articles a WHERE a.publisher_id = p.id
              AND a.published_at >= now() - interval '7 days' AND a.published_at < now() + interval '1 day'))::int AS healthy
    FROM publishers p WHERE p.feed_status = 'active' GROUP BY p.country_id)
SELECT 'cand|' || ds.id || '|' || coalesce(c.iso_code,'??') || '|' || coalesce(cov.healthy,0) || '/' || coalesce(cov.active,0)
       || '|' || coalesce(ds.score::text,'-') || '|' || ds.domain || '|' || left(coalesce(ds.site_title, ds.name, ''), 60)
       || '|' || coalesce(ds.source_type,'-') || '|feed=' || ds.feed_url || '|items=' || coalesce(ds.item_count::text,'-') || '|newest=' || coalesce(to_char(ds.latest_item_at,'YYYY-MM-DD'),'-')
       || '|seen=' || ds.times_seen || '|flags=' || coalesce(array_to_string(ds.flags, ','), '')
  FROM discovered_sources ds
  LEFT JOIN countries c ON c.id = ds.country_id
  LEFT JOIN cov ON cov.country_id = ds.country_id
 WHERE ds.status = 'under_review' AND ds.feed_url IS NOT NULL AND ds.health = 'ok'
 ORDER BY coalesce(cov.healthy, 0), ds.score DESC NULLS LAST;
