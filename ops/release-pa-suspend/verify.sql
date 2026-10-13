select 'verify|' || p.id || '|' || p.feed_status || '|' || string_agg(f.id || ':' || f.enabled, ' ') from publishers p join feeds f on f.publisher_id = p.id where p.id = 6757 group by p.id;
select 'polled|' || count(*) from publishers p join feeds f on f.publisher_id = p.id where p.feed_status = 'active' and f.enabled and p.id = 6757;
