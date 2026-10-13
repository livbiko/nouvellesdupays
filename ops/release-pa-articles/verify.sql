select 'fp|' || count(*) || '|' || coalesce((select md5(string_agg(row_to_json(a)::text, '~' order by id)) from articles a where publisher_id = 6757), '-') from articles a where publisher_id = 6757;
