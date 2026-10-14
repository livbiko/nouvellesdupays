select 'a|' || a.category || '|' || p.language || '|' || left(a.headline, 90) from articles a join publishers p on p.id = a.publisher_id
 where a.headline ilike '%700-foot cliff%' or a.headline ilike '%shoot itself in the foot%' or a.headline ilike 'Foot : %' order by a.id desc limit 6;
