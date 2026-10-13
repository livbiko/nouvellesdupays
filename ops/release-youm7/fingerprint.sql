select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 8954),
  (select row_to_json(s)::text from publisher_submissions s where id = 164),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where publisher_id = 8954),
  (select count(*) from articles where publisher_id = 8954)));
