\pset pager off
select 'pub|' || row_to_json(p)::text from publishers p where id = 6757;
select 'feed|' || row_to_json(f)::text from feeds f where publisher_id = 6757 order by id;
select 'sub|' || row_to_json(s)::text from publisher_submissions s where publisher_id = 6757 order by id;
select 'arts|' || count(*) || '|' || coalesce(min(published_at)::text,'-') || '|' || coalesce(max(published_at)::text,'-') || '|' || coalesce(max(fetched_at)::text,'-') from articles where publisher_id = 6757;
select 'recent|' || coalesce(published_at::text,'-') || '|' || left(headline, 90) || '|' || original_url from articles where publisher_id = 6757 order by fetched_at desc limit 8;
select 'other|' || id || '|' || name || '|' || feed_status from publishers where domain in ('pa.media','pressassociation.com') or name ilike '%press association%' order by id;
