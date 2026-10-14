-- Read-only review of the mapping in category-map.csv (copy it to postgres-0:/tmp first): transitions and
-- 150 random mapped headlines with their URL, for a hand precision check.
create temp table category_map (id bigint primary key, old text not null, new text not null);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
select 't|' || m.old || ' -> ' || m.new || '|' || count(*) from category_map m group by m.old, m.new order by count(*) desc;
select 'r|' || m.new || '|' || p.language || '|' || left(p.name, 14) || '|' || left(regexp_replace(a.headline, '\s+', ' ', 'g'), 80)
       || '|' || left(regexp_replace(a.original_url, '^https?://', ''), 60)
  from category_map m join articles a on a.id = m.id join publishers p on p.id = a.publisher_id
 order by random() limit 150;
