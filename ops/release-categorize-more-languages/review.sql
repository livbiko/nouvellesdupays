-- Read-only review of the mapping in category-map.csv (copy it to postgres-0:/tmp first): transitions (with the
-- last-pass design every change must be other -> something), moves per language, and 300 random mapped
-- headlines for a hand precision check on the final keyword lists.
create temp table category_map (id bigint primary key, old text not null, new text not null);
\copy category_map FROM '/tmp/category-map.csv' WITH CSV HEADER
select 't|' || m.old || ' -> ' || m.new || '|' || count(*) from category_map m group by m.old, m.new order by count(*) desc;
select 'l|' || p.language || '|' || count(*) from category_map m join articles a on a.id = m.id join publishers p on p.id = a.publisher_id
 group by p.language order by count(*) desc limit 20;
select 'r|' || m.new || '|' || p.language || '|' || left(p.name, 14) || '|' || left(regexp_replace(a.headline, '\s+', ' ', 'g'), 100)
  from category_map m join articles a on a.id = m.id join publishers p on p.id = a.publisher_id
 order by random() limit 250;
