select 'fp|' || md5(concat_ws('#', (select row_to_json(p)::text from publishers p where id = 6757), (select count(*) from publisher_submissions where publisher_id = 6757)));
