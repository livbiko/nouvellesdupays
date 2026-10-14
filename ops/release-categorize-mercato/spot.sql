select 'a|' || a.category || '|' || p.language || '|' || left(a.headline, 90) from articles a join publishers p on p.id = a.publisher_id
 where a.headline ~* '\mmercato\M' or a.headline ~* '\mfoot mercato\M' order by a.id desc limit 10;
