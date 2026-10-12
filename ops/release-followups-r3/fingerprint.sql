SELECT 'fp|' || md5(string_agg(x, '|' ORDER BY x)) FROM (
  SELECT 'p' || row_to_json(t)::text AS x FROM publishers t WHERE id IN (270, 8951)
  UNION ALL SELECT 'f' || row_to_json(t)::text FROM feeds t WHERE id = 270
  UNION ALL SELECT 's' || row_to_json(t)::text FROM publisher_submissions t WHERE id IN (137, 161, 168, 169, 170, 171)
  UNION ALL SELECT 'd' || row_to_json(t)::text FROM discovered_sources t WHERE id IN (382, 314, 357, 425, 477)
  UNION ALL SELECT 'n' || (SELECT count(*) FROM publishers) || '/' || (SELECT count(*) FROM feeds) || '/' || (SELECT count(*) FROM feeds WHERE publisher_id = 270)) z;
