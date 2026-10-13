\set ON_ERROR_STOP on
BEGIN;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 577),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where publisher_id = 577 and id = 577),
  (select count(*) from feeds where publisher_id = 577)));
-- Delfi.lt (publisher 577): the old feed https://www.delfi.lt/rss/ redirects to feed.delfi.lt, whose /v2?format=rss is a
-- channel index (403 from the cluster anyway). Article feed: https://feed.delfi.lt/v2/channel/global-lt?format=rss (Lithuanian, 50 items, dated; 200 from the cluster).
-- Owner approval 2026-10-13 ("approve the Delfi fix"); LOW per Get-ChangeRisk. Mirrors, in one guarded transaction:
--   POST  /api/admin/publishers/577/sources {feed_type: rss, feed_url}   PATCH /api/admin/sources/577 {enabled: false} (kept)
-- Reverse: reverse.sql.
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 577 AND name = 'Delfi.lt' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 577 is not the active Delfi.lt'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 577 AND publisher_id = 577 AND feed_url = 'https://www.delfi.lt/rss/' AND enabled) THEN
    RAISE EXCEPTION 'feed 577 is not the enabled old Delfi feed'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 577) <> 1 THEN
    RAISE EXCEPTION 'publisher 577 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss') THEN
    RAISE EXCEPTION 'a source with the new Delfi URL already exists'; END IF;
END $$;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (577, 'https://feed.delfi.lt/v2/channel/global-lt?format=rss', 'rss', NULL, true, true, '{}', '{}', '{}', '{}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 577;
select 'verify|' || string_agg(f.id || ':' || f.enabled || ':' || f.feed_url, ' ' order by f.id) from feeds f where f.publisher_id = 577;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 577),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where publisher_id = 577 and id = 577),
  (select count(*) from feeds where publisher_id = 577)));
-- Reverse of apply.sql: old Delfi feed re-enabled, the new source and the articles it stored deleted.
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE publisher_id = 577 AND feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss') THEN
    RAISE EXCEPTION 'nothing to reverse: the new Delfi source does not exist'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 577) <> 2 THEN
    RAISE EXCEPTION 'publisher 577 has sources other than the two expected'; END IF;
END $$;
DELETE FROM articles WHERE feed_id = (SELECT id FROM feeds WHERE feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss');
DELETE FROM feeds WHERE feed_url = 'https://feed.delfi.lt/v2/channel/global-lt?format=rss';
UPDATE feeds SET enabled = true WHERE id = 577;
select 'fp|' || md5(concat_ws('#',
  (select row_to_json(p)::text from publishers p where id = 577),
  (select string_agg(row_to_json(f)::text, '~' order by id) from feeds f where publisher_id = 577 and id = 577),
  (select count(*) from feeds where publisher_id = 577)));
ROLLBACK;
