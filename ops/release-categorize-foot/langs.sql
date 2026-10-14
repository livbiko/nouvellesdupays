-- Read-only: publisher language codes (French-only "foot" keys on ^fr(-|_|$)), and active publishers without a language.
select 'lang|' || coalesce(language, '<null>') || '|' || count(*) || '|' || count(*) FILTER (WHERE feed_status = 'active')
  from publishers group by language order by count(*) desc limit 40;
select 'frish|' || coalesce(language, '<null>') || '|' || count(*) from publishers
  where language ilike '%fr%' and language !~* '^fr($|[-_])' group by language;
select 'nolang|' || p.id || '|' || p.name || '|' || c.iso_code from publishers p join countries c on c.id = p.country_id
  where p.language is null and p.feed_status = 'active' order by p.id limit 30;
