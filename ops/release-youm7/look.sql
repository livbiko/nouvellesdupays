\pset pager off
select 'pub|' || row_to_json(p)::text from publishers p where id = 8954;
select 'feed|' || row_to_json(f)::text from feeds f where publisher_id = 8954;
select 'sub|' || row_to_json(s)::text from publisher_submissions s where id = 164;
select 'arts|' || count(*) from articles where publisher_id = 8954;
select 'dup|' || f.id || '|' || f.feed_url from feeds f where f.feed_url ilike '%youm7%' and f.publisher_id <> 8954;
select 'pcols|' || string_agg(column_name || ':' || data_type, ',') from information_schema.columns where table_name = 'publishers';
