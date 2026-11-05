-- Reverses Build #163: restores publisher 236 (La Radio Macuto) to its values before the recovery.
\set ON_ERROR_STOP on
BEGIN;
UPDATE publishers SET homepage_url = 'https://www.laradiomacuto.com', domain = 'laradiomacuto.com', feed_status = 'unavailable', description = NULL WHERE id = 236;
UPDATE feeds SET feed_url = 'https://www.laradiomacuto.com/feed', last_status = 'error: fetch failed', last_error = 'fetch failed',
  last_error_at = '2026-10-08 02:25:02.762064+00', consecutive_failures = 1562, etag = NULL, last_modified = NULL WHERE id = 236;
UPDATE editorial_profiles SET ownership_type = NULL, owner = NULL, classification_tags = ARRAY['unknown']::text[], confidence = 'low',
  historical_context = NULL, current_context = 'Aucune information de propriété accessible lors de cette recherche.',
  evidence_summary = 'Recherche infructueuse -- classification "non évalué".', evidence_sources = '[]'::jsonb,
  last_reviewed = '2026-09-14', evidence_date = '2026-09-14', review_required = true WHERE publisher_id = 236;
-- Articles ingested from radiomacuto.org after the recovery stay (they are real Radio Macuto items); delete them only if needed:
-- DELETE FROM articles WHERE publisher_id = 236 AND fetched_at > '2026-11-05 11:43Z';
COMMIT;
