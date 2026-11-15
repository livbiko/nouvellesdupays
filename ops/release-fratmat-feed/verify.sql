SELECT count(*) total, count(*) FILTER (WHERE published_at > fetched_at) future, min(published_at), max(published_at), max(fetched_at)
  FROM articles WHERE publisher_id = 7293;
SELECT split_part(original_url, '/', 6) AS section, count(*) FROM articles WHERE publisher_id = 7293 GROUP BY 1 ORDER BY 2 DESC;
SELECT published_at, left(headline, 70) FROM articles WHERE publisher_id = 7293 ORDER BY published_at DESC LIMIT 4;
