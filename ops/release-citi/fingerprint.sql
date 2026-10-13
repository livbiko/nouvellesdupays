select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 6764),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id = 6764),
  (select count(*) from feeds where publisher_id = 6764),
  (select count(*) from articles where publisher_id = 6764)));
