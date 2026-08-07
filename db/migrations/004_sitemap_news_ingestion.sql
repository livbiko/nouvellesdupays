-- Second ingestion format alongside RSS/Atom: Google News Sitemap
-- (sitemap-news.xml), for outlets with no RSS at all but that publish the
-- standard <news:news> sitemap format most CMSs already generate for
-- Google News. This is reading structured, machine-published data the site
-- deliberately exposes for search engines -- not scraping rendered HTML.

ALTER TABLE feeds DROP CONSTRAINT IF EXISTS feeds_feed_type_check;
ALTER TABLE feeds ADD CONSTRAINT feeds_feed_type_check
  CHECK (feed_type IN ('rss', 'atom', 'sitemap-news'));

-- Tracks which format actually verified for a pending submission, so
-- approval (db/review-submissions.js) inserts the feed with the right
-- feed_type instead of assuming 'rss'.
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS feed_type TEXT NOT NULL DEFAULT 'rss'
  CHECK (feed_type IN ('rss', 'sitemap-news'));
