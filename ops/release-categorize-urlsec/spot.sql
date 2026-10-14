select 'a|' || a.category || '|' || p.language || '|' || left(a.headline, 70) || '|' || left(a.original_url, 70) from articles a
  join publishers p on p.id = a.publisher_id where a.original_url ~ '/(deportes|politik|kultura|economia)/' order by a.id desc limit 8;
select 'mode|' || a.category || '|' || left(a.headline, 90) from articles a where a.headline ~* 'mercato de la mode';
