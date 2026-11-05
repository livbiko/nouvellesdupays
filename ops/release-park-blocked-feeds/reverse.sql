-- Reverses the park of blocked publishers: the 16 publishers back to active, the 2 extra feeds re-enabled. Feed error state was not changed.
\set ON_ERROR_STOP on
BEGIN;
UPDATE publishers SET feed_status = 'active' WHERE slug IN ('fraternite-benin', 'newsbook', 'sun-mv', 'sun-mv-sunonline', 'psm-news',
  'eyewitness-news', 'the-guardian-nigeria', 'aps', 'nation-news', 'sunday-standard', '15min-lt', 'news-of-bahrain', 'khmer-times',
  'modern-ghana', 'press-tv', 'the-rising-nepal') AND feed_status = 'unavailable';
UPDATE feeds SET enabled = true WHERE id IN (9453, 9291);
COMMIT;
