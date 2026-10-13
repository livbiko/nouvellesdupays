\pset pager off
select 'fk|' || c.conrelid::regclass::text || '|' || c.conname || '|' || c.confdeltype::text || '|' || pg_get_constraintdef(c.oid) from pg_constraint c where c.contype = 'f' and c.confrelid = 'articles'::regclass order by c.conname;
select 'trg|' || tgname from pg_trigger where tgrelid = 'articles'::regclass and not tgisinternal;
select 'cols|' || table_name || '.' || column_name || ':' || data_type from information_schema.columns where table_schema = 'public' and (column_name like '%article%') order by 1;
select 'events|' || count(*) from analytics_events where article_id in (select id from articles where publisher_id = 6757);
