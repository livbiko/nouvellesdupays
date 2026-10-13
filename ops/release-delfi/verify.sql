select 'verify|' || string_agg(f.id || ':' || f.enabled || ':' || f.feed_url, ' ' order by f.id) from feeds f where f.publisher_id = 577;
select 'arts|' || count(*) || '|' || count(*) filter (where published_at is null) || '|' || coalesce(max(fetched_at)::text, '-')
from articles a where a.feed_id = (select id from feeds where publisher_id = 577 and id <> 577);
