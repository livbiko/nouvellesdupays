select 'citi|' || category || '|' || left(headline, 80) from articles where feed_id = 8977 and (headline ilike '%passport%' or headline ilike '%occupants%' or headline ilike '%economic%') order by id;
select 'new|' || category || '|' || left(headline, 80) from articles where fetched_at > '2026-10-13 21:55' and (headline ilike '%sport%' or headline ilike '%cup%') order by id desc limit 8;
