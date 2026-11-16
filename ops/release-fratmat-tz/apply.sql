-- Build #262 (owner: "approve 1"): Fraternité Matin (publisher 7293, source 10253 added in Build #256) writes Abidjan
-- wall-clock time with a "+0200" label (all 50 items 11-16), so every article was stored 2 h early: new articles were
-- first seen 2h07-2h25 after their stored time while the feed is polled every 5 min. Fix with the existing worker
-- option label_time_zone (Build of 10-19: Cairo 24, FENA...): the time as written, placed in Africa/Abidjan (UTC, no
-- DST), whatever the label says. The 71 stored articles move 2 h later (never past their fetch time; checked: none
-- would). Reverse: reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 10253 AND publisher_id = 7293 AND feed_url = 'https://www.fratmat.info/rssFeed/0'
                 AND NOT (parser_config ?| ARRAY['label_time_zone', 'label_utc_offset_hours'])) THEN
    RAISE EXCEPTION 'source 10253 is not the Fraternité Matin feed without a time-zone option'; END IF;
  IF EXISTS (SELECT 1 FROM articles WHERE publisher_id = 7293 AND published_at + interval '2 hours' > fetched_at) THEN
    RAISE EXCEPTION 'an article would move past its fetch time'; END IF;
END $$;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Africa/Abidjan"}'::jsonb WHERE id = 10253;
CREATE TEMP TABLE b262_moved ON COMMIT DROP AS SELECT id FROM articles WHERE publisher_id = 7293;
UPDATE articles SET published_at = published_at + interval '2 hours' WHERE id IN (SELECT id FROM b262_moved);
SELECT (SELECT parser_config FROM feeds WHERE id = 10253) AS cfg, count(*) AS moved,
       min(published_at), max(published_at), max(fetched_at - published_at) AS max_lag
  FROM articles WHERE id IN (SELECT id FROM b262_moved);
COMMIT;
