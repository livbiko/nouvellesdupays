-- Feed time-zone labels (LOW, data only; owner, 2026-11-05: "fix the 4 time zones"). These feeds write local time
-- with a wrong zone label, so items showed up to hours in the future (clamped to fetch time) or hours late:
--   1039 The Jerusalem Post  "14:19:44 GMT" (article page says +00:00 too, still future) = Israel time -> Asia/Jerusalem
--   9725 2424.mg             "14:26:54 GMT" while the article page shows 15:26 Madagascar time -> UTC+2 -> offset 2
--   173  Leaders (TN)        "14:32 GMT" seen at 13:32 UTC -> Tunisia time (inferred) -> Africa/Tunis
--   998  Mothership (SG)     "2026-11-05T17:27:57", no zone -> Singapore time (inferred) -> Asia/Singapore
-- Existing worker options (label_time_zone / label_utc_offset_hours); stored articles are not changed.
-- Worker parse checked locally with these exact strings. rehearse.sql = ROLLBACK; reverse.sql removes the keys.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF (SELECT count(*) FROM feeds f JOIN publishers p ON p.id = f.publisher_id
      WHERE (f.id, p.slug) IN ((1039, 'the-jerusalem-post'), (9725, '2424-mg'), (173, 'leaders'), (998, 'mothership'))
        AND NOT (f.parser_config ?| ARRAY['label_time_zone', 'label_utc_offset_hours'])) <> 4 THEN
    RAISE EXCEPTION 'The 4 feeds are not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Asia/Jerusalem"}'::jsonb WHERE id = 1039;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_utc_offset_hours": 2}'::jsonb WHERE id = 9725;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Africa/Tunis"}'::jsonb WHERE id = 173;
UPDATE feeds SET parser_config = coalesce(parser_config, '{}'::jsonb) || '{"label_time_zone": "Asia/Singapore"}'::jsonb WHERE id = 998;
SELECT id, parser_config FROM feeds WHERE id IN (1039, 9725, 173, 998) ORDER BY id;
ROLLBACK;
