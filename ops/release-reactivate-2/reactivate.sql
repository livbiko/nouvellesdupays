-- Reactivate Inforpress (8918) and L'Essor (8922) after the crawler generic-title guard (Build #50),
-- owner request 2026-10-11. Same as the admin "activer" action; Inforpress's crawl source moves from its
-- broken sitemap (lists localhost URLs) to its homepage /pt. Both marked for an immediate crawl. Guarded.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM publishers WHERE id IN (8918, 8922) AND feed_status = 'suspended') <> 2
     OR (SELECT count(*) FROM publisher_submissions WHERE id IN (80, 89) AND status = 'suspended') <> 2
     OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8916 AND publisher_id = 8918 AND feed_type = 'sitemap' AND feed_url = 'https://inforpress.cv/sitemap.xml')
     OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8920 AND publisher_id = 8922 AND feed_type = 'html' AND feed_url = 'https://lessor.ml/') THEN
    RAISE EXCEPTION 'state differs from snapshot-before.txt - nothing changed';
  END IF;
END $$;
UPDATE feeds SET feed_type = 'html', feed_url = 'https://inforpress.cv/pt', last_fetched_at = NULL WHERE id = 8916;
UPDATE feeds SET last_fetched_at = NULL WHERE id = 8920;
UPDATE publishers SET feed_status = 'active' WHERE id IN (8918, 8922);
UPDATE publisher_submissions SET status = 'active', status_changed_at = now(),
  reviewer_note = 'Reactivated 2026-10-11 after the crawler generic-title guard (Build #50); earlier: ' || reviewer_note
  WHERE id IN (80, 89);
SELECT p.id, p.name, p.feed_status, f.feed_type, f.feed_url FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id IN (8918, 8922) ORDER BY p.id;
COMMIT;
