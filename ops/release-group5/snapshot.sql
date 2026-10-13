\pset pager off
select 'pub|' || row_to_json(p)::text from publishers p where id IN (6762,1037,209) order by id;
select 'feed|' || row_to_json(f)::text from feeds f where publisher_id IN (6762,1037,209) order by id;
select 'dup|' || id || '|' || publisher_id || '|' || feed_url from feeds where feed_url IN ('https://www.aib.media/?feed=rss2', 'https://saudigazette.com.sa/sitemaps/news_sitemap.xml', 'https://standard.gm/news-sitemap.xml');
select 'oldarts|' || publisher_id || '|' || count(*) from articles where publisher_id IN (6762,1037,209) group by publisher_id order by publisher_id;
