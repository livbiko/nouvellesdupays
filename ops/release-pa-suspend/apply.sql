-- PA Media (publisher 6757, GB): pa.media was folded into pressassociation.com on 2026-10-12. https://pa.media/feed/ now redirects
-- to an HTML page (parse error "Attribute without value"); old /blogs/ article links redirect to /news-showcase; the new
-- pressassociation.com/feed.xml is the corporate PR blog, not news. No submission row exists, so this mirrors
--   PATCH /api/admin/publishers/6757 {feed_status: 'suspended'}   (poller then skips it; publisher hidden from country lists; articles kept)
-- MEDIUM per Get-ChangeRisk. Reverse: reverse.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 6757 AND name = 'PA Media (Press Association)' AND domain = 'pa.media' AND feed_status = 'active') THEN
    RAISE EXCEPTION 'publisher 6757 is not the active PA Media'; END IF;
  IF EXISTS (SELECT 1 FROM publisher_submissions WHERE publisher_id = 6757) THEN
    RAISE EXCEPTION 'publisher 6757 has a submission: use the submission suspend path instead'; END IF;
END $$;
UPDATE publishers SET feed_status = 'suspended' WHERE id = 6757;
COMMIT;
