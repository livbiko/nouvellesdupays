SELECT 'artc|' || p.slug || '|' || coalesce(c.iso_code,'NULL') || '|' || count(*) || '|newest=' || to_char(max(a.published_at),'MM-DD HH24:MI')
  FROM articles a JOIN publishers p ON p.id = a.publisher_id LEFT JOIN countries c ON c.id = a.country_id
 WHERE p.slug IN ('atoll-times','corporate-maldives','mehielinfo','artici') GROUP BY p.slug, c.iso_code ORDER BY p.slug;
SELECT 'mvtop|' || to_char(a.published_at,'MM-DD HH24:MI') || '|' || p.name FROM articles a JOIN publishers p ON p.id=a.publisher_id
 JOIN countries c ON c.id = a.country_id WHERE c.iso_code='MV' ORDER BY a.published_at DESC NULLS LAST LIMIT 5;
