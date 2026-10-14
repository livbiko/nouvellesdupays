-- Read-only spot check after the release: newest articles from a few languages that the last pass moved.
select 's|' || a.category || '|' || p.language || '|' || left(regexp_replace(a.headline, '\s+', ' ', 'g'), 90) from articles a
  join publishers p on p.id = a.publisher_id
 where p.language in ('es', 'pt', 'de', 'id', 'sq') and a.category <> 'other' and a.fetched_at > now() - interval '2 hours'
 order by a.id desc limit 15;
