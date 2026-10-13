select 'arts|' || count(*) || '|' || count(*) filter (where published_at is null) || '|' || coalesce(min(published_at)::text, '-') || '|' || coalesce(max(published_at)::text, '-') || '|' || coalesce(max(fetched_at)::text, '-')
from articles where publisher_id = 8954;
