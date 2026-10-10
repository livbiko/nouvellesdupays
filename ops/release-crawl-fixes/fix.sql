-- Crawled sources follow-up, owner request 2026-10-10 ("yes, go ahead"). Dry-runs showed only
-- Modern Ghana can be crawled properly; the others give our bot junk/404 pages.
-- Back up articles first (pod): \copy (SELECT * FROM articles WHERE id IN (...)) TO /tmp/articles-crawl-junk.csv
\set ON_ERROR_STOP on
BEGIN;
SELECT id FROM publishers WHERE id IN (8914,8918,8919,8922,8923,8924) FOR UPDATE;
DO $$
BEGIN
  IF (SELECT count(*) FROM publishers WHERE id IN (8914,8918,8922,8923,8924,8919) AND feed_status = 'active') <> 6
     OR (SELECT count(*) FROM publisher_submissions WHERE id IN (70,80,89,91,92) AND status = 'active') <> 5
     OR NOT EXISTS (SELECT 1 FROM feeds WHERE id = 8917 AND publisher_id = 8919 AND feed_url = 'https://www.modernghana.com/sitemap.xml')
     OR (SELECT count(*) FROM articles WHERE publisher_id IN (8914,8918,8922,8923,8924)) <> 6
     OR (SELECT count(*) FROM articles WHERE id IN (168217143,168217166,168217173,168217174,168217175,168217184)) <> 6 THEN
    RAISE EXCEPTION 'state differs from snapshot-before.txt - nothing changed';
  END IF;
END $$;
-- 1. Modern Ghana: crawl the homepage + 4 sections, keep /news/<id>/... links (dry-run: 125 article URLs, real headlines).
UPDATE feeds SET feed_type = 'html', feed_url = 'https://www.modernghana.com/',
  category_urls = ARRAY['https://www.modernghana.com/ghanahome/news/', 'https://www.modernghana.com/ghanahome/business/',
                        'https://www.modernghana.com/ghanahome/africa/', 'https://www.modernghana.com/ghanahome/sports/'],
  article_url_patterns = ARRAY['/news/*'], last_fetched_at = NULL
  WHERE id = 8917;
-- 2. Suspend the 5 that cannot be crawled properly (as POST /api/admin/submissions/:id/suspend).
UPDATE publisher_submissions SET status = 'suspended', status_changed_at = now(), reviewer_note = CASE id
    WHEN 70 THEN 'Suspended 2026-10-10: article pages answer "Content Not Found" to our bot and the RSS feed is malformed; only page titles were collected.'
    WHEN 80 THEN 'Suspended 2026-10-10: sitemap points to localhost and article pages carry only generic titles (headline drawn by JavaScript).'
    WHEN 89 THEN 'Suspended 2026-10-10: article pages carry only the site title (headline drawn by JavaScript).'
    WHEN 91 THEN 'Suspended 2026-10-10: article pages and /feed/ answer 404 to our bot (bot protection).'
    WHEN 92 THEN 'Suspended 2026-10-10: domain taken over by a French content farm (home renovation, camping), not Burkinabè news.'
  END
  WHERE id IN (70, 80, 89, 91, 92);
UPDATE publishers SET feed_status = 'suspended' WHERE id IN (8914, 8918, 8922, 8923, 8924);
-- 3. Remove the 6 junk items (backed up in articles-crawl-junk.csv).
DELETE FROM articles WHERE id IN (168217143,168217166,168217173,168217174,168217175,168217184);
SELECT p.id, p.name, p.feed_status, f.feed_type, (SELECT count(*) FROM articles a WHERE a.publisher_id = p.id) FROM publishers p JOIN feeds f ON f.publisher_id = p.id WHERE p.id IN (8914,8918,8919,8922,8923,8924) ORDER BY p.id;
COMMIT;
