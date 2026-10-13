\pset pager off
select 'pub|' || row_to_json(p)::text from publishers p where id = 577;
select 'feed|' || row_to_json(f)::text from feeds f where publisher_id = 577;
select 'dup|' || id || '|' || publisher_id from feeds where feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss';
