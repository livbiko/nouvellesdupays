-- Youm7 (publisher 8954, submission 164): switch to its breaking-news RSS feed with Cairo-time Arabic dates, and activate.
-- Owner approval 2026-10-13 ("approve both"). Mirrors, in one guarded transaction:
--   POST  /api/admin/publishers/8954/sources  {feed_type: rss, feed_url, parser_config: {time_zone: Africa/Cairo}}
--   PATCH /api/admin/sources/8952             {enabled: false}   (the never-run html crawl; kept)
--   POST  /api/admin/submissions/164/activate
-- Run only after the worker image with parseArabicDate is live (else the first poll stores the items undated).
-- Reverse: reverse.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 8954 AND domain = 'youm7.com' AND feed_status = 'pending') THEN
    RAISE EXCEPTION 'publisher 8954 is not the pending Youm7 publisher'; END IF;
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 164 AND publisher_id = 8954 AND status = 'approved') THEN
    RAISE EXCEPTION 'submission 164 is not approved for publisher 8954'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8952 AND publisher_id = 8954 AND feed_type = 'html' AND enabled AND last_fetched_at IS NULL) THEN
    RAISE EXCEPTION 'feed 8952 is not the unused enabled html source'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 8954) <> 1 THEN
    RAISE EXCEPTION 'publisher 8954 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM feeds WHERE feed_url = 'https://www.youm7.com/rss/SectionRss?SectionID=65') THEN
    RAISE EXCEPTION 'a source with the Youm7 RSS URL already exists'; END IF;
  IF EXISTS (SELECT 1 FROM articles WHERE publisher_id = 8954) THEN
    RAISE EXCEPTION 'publisher 8954 already has articles'; END IF;
END $$;
INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
                   allowed_domains, category_urls, article_url_patterns, parser_config)
VALUES (8954, 'https://www.youm7.com/rss/SectionRss?SectionID=65', 'rss', NULL, true, true,
        '{}', '{}', '{}', '{"time_zone": "Africa/Cairo"}'::jsonb);
UPDATE feeds SET enabled = false WHERE id = 8952;
UPDATE publishers SET feed_status = 'active' WHERE id = 8954;
UPDATE publisher_submissions
   SET status = 'active', status_changed_at = now(),
       reviewer_note = reviewer_note || E'\nActivated 2026-10-13: switched to the breaking-news RSS feed (SectionID=65); Arabic dates parsed in Cairo time (worker parser_config.time_zone). Unused html source 8952 disabled, kept.'
 WHERE id = 164;
COMMIT;
