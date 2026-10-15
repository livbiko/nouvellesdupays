-- Read-only review of the mapping in category-map.csv (copy it to postgres-0:/tmp first): transitions per publisher
-- and up to 300 random mapped headlines for a hand precision check.
create temp table category_map (id bigint primary key, old text not null, new text not null);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
select 't|' || a.publisher_id || '|' || m.old || ' -> ' || m.new || '|' || count(*) from category_map m join articles a on a.id = m.id
 group by a.publisher_id, m.old, m.new order by count(*) desc;
select 'r|' || a.publisher_id || '|' || m.old || '>' || m.new || '|' || left(regexp_replace(a.headline, '\s+', ' ', 'g'), 110)
  from category_map m join articles a on a.id = m.id order by random() limit 300;
