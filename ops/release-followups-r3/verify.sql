-- Read-only: 'verify|ok' when every change from apply.sql is in place, else 'verify|fail|<what>'.
SELECT 'verify|' || CASE WHEN array_length(fails, 1) IS NULL THEN 'ok' ELSE 'fail|' || array_to_string(fails, ', ') END FROM (
  SELECT array_remove(ARRAY[
    CASE WHEN NOT EXISTS (SELECT 1 FROM publishers WHERE id = 270 AND domain = 'nbcnews.na' AND homepage_url = 'https://nbcnews.na/' AND feed_status = 'active') THEN 'nbc publisher' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 270 AND feed_url = 'https://nbcnews.na/rss.xml' AND enabled) THEN 'nbc new source' END,
    CASE WHEN EXISTS (SELECT 1 FROM feeds WHERE id = 270 AND enabled) THEN 'nbc old source still on' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 137 AND status = 'rejected') THEN '137' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM discovered_sources WHERE id = 382 AND status = 'registered') THEN '382' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 161 AND status = 'suspended') THEN '161' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM publishers WHERE id = 8951 AND feed_status = 'suspended') THEN 'keydmedia' END,
    CASE WHEN (SELECT count(*) FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
               WHERE s.id IN (168, 169, 170) AND s.status = 'approved' AND p.feed_status = 'active' AND f.feed_type = 'rss' AND f.enabled) <> 3 THEN '168-170' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM publisher_submissions s JOIN publishers p ON p.id = s.publisher_id JOIN feeds f ON f.publisher_id = p.id
               WHERE s.id = 171 AND s.status = 'active' AND p.feed_status = 'active' AND f.feed_type = 'html'
                 AND f.feed_url = 'https://www.tnx.africa/' AND f.article_url_patterns = ARRAY['/*/article/*']) THEN '171' END,
    CASE WHEN (SELECT count(*) FROM discovered_sources WHERE id IN (314, 357, 425, 477) AND status = 'registered') <> 4 THEN 'candidates' END
  ], NULL) AS fails) x;
