SELECT f.last_fetched_at, f.last_status, left(coalesce(f.last_error,''),100), (SELECT count(*) FROM articles WHERE publisher_id=7293) FROM feeds f WHERE f.id=10253;
