-- Build #163 (MEDIUM): recover La Radio Macuto (GQ, publisher 236), which moved from laradiomacuto.com (dead since
-- 10-08, 1,562 failed fetches) to radiomacuto.org. Owner, 2026-11-05: "recover Macuto". Record and ids are kept.
-- rehearse.sql is this file with ROLLBACK; reverse.sql restores the previous values exactly.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
BEGIN;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishers WHERE id = 236 AND slug = 'la-radio-macuto' AND domain = 'laradiomacuto.com' AND feed_status = 'unavailable')
     OR EXISTS (SELECT 1 FROM publishers WHERE domain = 'radiomacuto.org') THEN
    RAISE EXCEPTION 'Publisher 236 is not in the expected state - nothing changed';
  END IF;
END $do$;
UPDATE publishers SET homepage_url = 'https://radiomacuto.org/', domain = 'radiomacuto.org', feed_status = 'active',
  description = 'Equatoguinean opposition radio and news site working from exile; Spanish and French.'
  WHERE id = 236;
UPDATE feeds SET feed_url = 'https://radiomacuto.org/feed/', last_status = NULL, last_error = NULL, last_error_at = NULL,
  consecutive_failures = 0, etag = NULL, last_modified = NULL
  WHERE id = 236 AND publisher_id = 236;
UPDATE editorial_profiles SET ownership_type = 'Média d''opposition en exil', owner = 'Non vérifié',
  classification_tags = ARRAY['opposition_aligned']::text[], confidence = 'medium',
  historical_context = 'Radio et site d''information d''opposition équato-guinéen, travaillant depuis l''exil.',
  current_context = 'Couverture très critique du régime Obiang (justice, finances publiques, police, CEMAC), en espagnol et en français. Domaine passé de laradiomacuto.com à radiomacuto.org (2026).',
  evidence_summary = 'Contenu du flux (2026-11-05) systématiquement critique du gouvernement ; identité reprise du site officiel ; propriétaire et financement non vérifiés pour ce profil.',
  evidence_sources = '[{"url": "https://radiomacuto.org/", "note": "Site officiel : Radio Macuto", "category": "self_description", "accessed_at": "2026-11-05"}]'::jsonb,
  last_reviewed = '2026-11-05', evidence_date = '2026-11-05', review_required = true
  WHERE publisher_id = 236;
SELECT p.id, p.slug, p.domain, p.feed_status, f.feed_url, f.consecutive_failures, e.classification_tags
  FROM publishers p JOIN feeds f ON f.publisher_id = p.id JOIN editorial_profiles e ON e.publisher_id = p.id WHERE p.id = 236;
COMMIT;
