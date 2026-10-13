\pset pager off
select 'arts|' || count(*) || '|' || min(id) || '|' || max(id) || '|' || md5(string_agg(row_to_json(a)::text, '~' order by id)) from articles a where publisher_id = 6757;
select 'pub|' || id || '|' || feed_status from publishers where id = 6757;
select 'fk|' || c.conrelid::regclass || '|' || c.conname || '|' || c.confdeltype || '|' || pg_get_constraintdef(c.oid) from pg_constraint c where c.contype = 'f' and c.confrelid = 'articles'::regclass order by 2;
select 'trg|' || tgname from pg_trigger where tgrelid = 'articles'::regclass and not tgisinternal;
