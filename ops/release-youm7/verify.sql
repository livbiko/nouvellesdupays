select 'verify|' || p.feed_status || '|' || s.status || '|' ||
  (select string_agg(f.id || ':' || f.feed_type || ':' || f.enabled || ':' || f.parser_config::text, ' ' order by f.id) from feeds f where f.publisher_id = 8954)
from publishers p, publisher_submissions s where p.id = 8954 and s.id = 164;
