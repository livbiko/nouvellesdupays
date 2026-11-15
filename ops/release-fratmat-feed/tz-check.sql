SELECT published_at, fetched_at, fetched_at - published_at AS lag, left(headline,60) FROM articles WHERE publisher_id=7293 AND fetched_at > '2026-11-15 16:31' ORDER BY fetched_at LIMIT 3;
