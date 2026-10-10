-- Reverse of reactivate.sql (state in snapshot-before.txt). Articles crawled meanwhile are kept unless removed separately.
\set ON_ERROR_STOP on
BEGIN;
UPDATE feeds SET feed_type = 'sitemap', feed_url = 'https://inforpress.cv/sitemap.xml' WHERE id = 8916;
UPDATE publishers SET feed_status = 'suspended' WHERE id IN (8918, 8922);
UPDATE publisher_submissions SET status = 'suspended',
  reviewer_note = regexp_replace(reviewer_note, '^Reactivated 2026-10-11 after the crawler generic-title guard \(Build #50\); earlier: ', '')
  WHERE id IN (80, 89);
COMMIT;
