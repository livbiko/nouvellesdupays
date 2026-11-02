-- Read-only: state of the ON-PREM production DB vs the 11-02 releases (applied to OKE only).
SELECT 'db|' || current_database() || '|' || inet_server_addr() || '|' || version();
SELECT 'active|' || count(*) FROM publishers WHERE feed_status = 'active';
SELECT 'newest_article|' || max(fetched_at) || '|' || max(published_at) FILTER (WHERE published_at < now() + interval '1 day') FROM articles WHERE id > (SELECT max(id) - 50000 FROM articles);
SELECT 'slug|' || s || '|' || coalesce((SELECT id::text || ' ' || feed_status FROM publishers WHERE slug = s), 'absent')
  FROM unnest(ARRAY['citizen-tanzania','mwananchi-tz','new-times-rwanda','lavieeco','nawaat','sudan-tribune',
                    'atoll-times','corporate-maldives','mehielinfo','artici']) s;
SELECT 'mv|' || p.id || '|' || p.name || '|' || p.feed_status || '|fails=' || coalesce(f.consecutive_failures,0) || '|' || coalesce(f.last_error,'')
  FROM publishers p JOIN countries c ON c.id = p.country_id LEFT JOIN feeds f ON f.publisher_id = p.id WHERE c.iso_code = 'MV';
SELECT 'maxid|publishers=' || (SELECT max(id) FROM publishers) || '|submissions=' || (SELECT max(id) FROM publisher_submissions) || '|feeds=' || (SELECT max(id) FROM feeds);
SELECT 'mig|' || string_agg(name, ',' ORDER BY name) FROM (SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 3) m;
