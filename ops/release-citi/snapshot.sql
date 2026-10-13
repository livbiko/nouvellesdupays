\pset pager off
select 'pub|' || row_to_json(p)::text from publishers p where id = 6764;
select 'feed|' || row_to_json(f)::text from feeds f where publisher_id = 6764 order by id;
select 'sub|' || id || '|' || status from publisher_submissions where publisher_id = 6764;
select 'dup|' || id || '|' || publisher_id from feeds where feed_url = 'https://www.citinewsroom.com/';
select 'oldarts|' || count(*) from articles where publisher_id = 6764;
select 'setting|' || key || '|' || value::text from app_settings where key like 'crawler%';
select 'ref|' || id || '|' || publisher_id || '|' || crawl_frequency_minutes || '|' || feed_url || '|' || allowed_domains::text || '|' || category_urls::text || '|' || article_url_patterns::text || '|' || coalesce(last_status,'-') from feeds where feed_type = 'html' and enabled order by last_success_at desc nulls last limit 3;
