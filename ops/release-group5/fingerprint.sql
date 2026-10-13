select 'fp|' || md5(concat_ws('#',
  (select string_agg(row_to_json(p)::text, '~' order by id) from publishers p where id IN (6762,1037,209)),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where id IN (6762,1037,209)),
  (select count(*) from feeds where publisher_id IN (6762,1037,209)),
  (select count(*) from articles where publisher_id IN (6762,1037,209))));
