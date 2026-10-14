-- Read-only, after cancelling the rehearsal: no mapped article may be at its new category, and ingestion resumed.
create temp table category_map (id bigint primary key, old text not null, new text not null);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
select 'state|' || count(*) || '|' || count(*) filter (where a.category = m.new) || '|' || count(*) filter (where a.category = m.old) || '|' || count(*) filter (where a.id is null)
  from category_map m left join articles a on a.id = m.id;
select 'ingest|' || to_char(date_trunc('minute', fetched_at), 'HH24:MI') || '|' || count(*) from articles
 where fetched_at > now() - interval '50 minutes' group by 1 order by 1;
select 'now|' || to_char(now(), 'HH24:MI:SS');
