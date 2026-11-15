-- Build #253 (MEDIUM, owner: "approve Build #253"): activate RTS (publisher 8900, submission 95, pending since 10-09).
-- Its html source 8898 (https://www.rts.sn/) never ran because the publisher was pending. Dry run of the worker's crawler
-- 11-15 (read-only, bot UA, rts.sn has no robots.txt): 4 "À la une" articles, headlines + links, NO machine-readable
-- date -> parser_config {"undated": "fetch_time"} (Baltic Times precedent): dated when first seen, hourly crawl.
-- Mirrors POST /api/admin/submissions/95/activate plus the source option and an editorial profile. Reverse: reverse.sql.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 8900 AND domain = 'rts.sn' AND feed_status = 'pending') THEN
    RAISE EXCEPTION 'publisher 8900 is not the pending RTS publisher'; END IF;
  IF NOT EXISTS (SELECT 1 FROM publisher_submissions WHERE id = 95 AND publisher_id = 8900 AND status = 'approved') THEN
    RAISE EXCEPTION 'submission 95 is not approved for publisher 8900'; END IF;
  IF NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8898 AND publisher_id = 8900 AND feed_type = 'html' AND enabled
                 AND last_fetched_at IS NULL AND parser_config = '{}'::jsonb) THEN
    RAISE EXCEPTION 'feed 8898 is not the unused html source'; END IF;
  IF (SELECT count(*) FROM feeds WHERE publisher_id = 8900) <> 1 THEN RAISE EXCEPTION 'publisher 8900 has other sources'; END IF;
  IF EXISTS (SELECT 1 FROM articles WHERE publisher_id = 8900) THEN RAISE EXCEPTION 'publisher 8900 already has articles'; END IF;
  IF EXISTS (SELECT 1 FROM editorial_profiles WHERE publisher_id = 8900) THEN RAISE EXCEPTION 'RTS already has a profile'; END IF;
END $do$;
UPDATE feeds SET parser_config = '{"undated": "fetch_time"}'::jsonb WHERE id = 8898;
UPDATE publishers SET feed_status = 'active', source_type = 'TV' WHERE id = 8900;  -- its own description is kept
UPDATE publisher_submissions
   SET status = 'active', status_changed_at = now(),
       reviewer_note = coalesce(reviewer_note || E'\n', '') || 'Activated 2026-11-15 (Build #253): html crawl of the homepage, items undated so dated at first sight (parser_config undated=fetch_time) [Build #253]'
 WHERE id = 95;
INSERT INTO editorial_profiles (publisher_id, ownership_type, owner, classification_tags, political_party_association,
  historical_context, current_context, confidence, evidence_summary, evidence_sources,
  classification_date, last_reviewed, evidence_date, review_required)
VALUES (8900, 'Radiodiffuseur public', 'Non vérifié', ARRAY['public_state']::text[], NULL,
  'Radiodiffusion Télévision Sénégalaise, radiodiffuseur public du Sénégal.', 'Actualité sénégalaise et institutionnelle en français.', 'low',
  'Radiodiffuseur public selon sa propre présentation ; tutelle et gouvernance non vérifiées pour ce profil.',
  '[{"url": "https://www.rts.sn/", "note": "Site officiel : RTS", "category": "self_description", "accessed_at": "2026-11-15"}]'::jsonb,
  '2026-11-15', '2026-11-15', '2026-11-15', true);
SELECT p.id, p.feed_status, p.source_type, f.id AS feed_id, f.parser_config FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id = 8900;
COMMIT;
