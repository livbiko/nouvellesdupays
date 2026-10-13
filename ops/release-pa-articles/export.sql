\copy (select * from articles where publisher_id = 6757 order by id) TO '/tmp/articles-6757.csv' WITH CSV HEADER
select 'exported';
