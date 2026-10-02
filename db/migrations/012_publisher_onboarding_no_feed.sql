-- Publisher onboarding for news websites WITHOUT an RSS/Atom/API feed.
--
-- Extends the existing publisher_submissions table (rather than adding a
-- parallel one) so the existing feed-verified flow keeps working unchanged:
--   * feed-based submissions still land in status 'pending' after automatic
--     feed verification, exactly as before;
--   * feed-less submissions land in 'submitted' and go through
--     submitted -> pending (review) -> approved -> active, with
--     rejected / suspended as side exits.
-- 'pending' is displayed as "PENDING REVIEW" in the admin UI.
--
-- Feed-less sources become ordinary rows in the existing `feeds` table with
-- feed_type 'sitemap' or 'html', so the existing worker, articles table and
-- admin views all keep working. Crawl controls (frequency, allowed domains,
-- robots.txt compliance, parser config, enabled) are columns on `feeds`.
--
-- Idempotent: safe to re-run.

-- publisher_submissions ---------------------------------------------------

ALTER TABLE publisher_submissions ALTER COLUMN feed_url DROP NOT NULL;
ALTER TABLE publisher_submissions ALTER COLUMN feed_verified SET DEFAULT false;
ALTER TABLE publisher_submissions ALTER COLUMN feed_type DROP NOT NULL;
ALTER TABLE publisher_submissions ALTER COLUMN feed_type DROP DEFAULT;

ALTER TABLE publisher_submissions DROP CONSTRAINT IF EXISTS publisher_submissions_status_check;
ALTER TABLE publisher_submissions ADD CONSTRAINT publisher_submissions_status_check
  CHECK (status IN ('submitted', 'pending', 'approved', 'active', 'rejected', 'suspended'));

ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS x_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS api_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS sitemap_url TEXT;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS category_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS article_url_patterns TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS ingestion_method TEXT NOT NULL DEFAULT 'feed';
ALTER TABLE publisher_submissions DROP CONSTRAINT IF EXISTS publisher_submissions_ingestion_method_check;
ALTER TABLE publisher_submissions ADD CONSTRAINT publisher_submissions_ingestion_method_check
  CHECK (ingestion_method IN ('feed', 'api', 'sitemap', 'html'));
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS permission_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS publisher_id INTEGER REFERENCES publishers(id);
ALTER TABLE publisher_submissions ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

UPDATE publisher_submissions
SET domain = regexp_replace(regexp_replace(regexp_replace(homepage_url, '^https?://', ''), '^www\.', ''), '/.*$', '')
WHERE domain IS NULL;

CREATE INDEX IF NOT EXISTS idx_publisher_submissions_domain ON publisher_submissions (domain);

-- publishers ----------------------------------------------------------------

ALTER TABLE publishers DROP CONSTRAINT IF EXISTS publishers_feed_status_check;
ALTER TABLE publishers ADD CONSTRAINT publishers_feed_status_check
  CHECK (feed_status IN ('active', 'unavailable', 'pending', 'suspended'));

ALTER TABLE publishers ADD COLUMN IF NOT EXISTS x_url TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS description TEXT;

-- feeds (= sources) --------------------------------------------------------

ALTER TABLE feeds DROP CONSTRAINT IF EXISTS feeds_feed_type_check;
ALTER TABLE feeds ADD CONSTRAINT feeds_feed_type_check
  CHECK (feed_type IN ('rss', 'atom', 'sitemap-news', 'sitemap', 'html'));

-- NULL frequency = poll on every worker run (the existing behaviour for
-- RSS/Atom feeds, left untouched). Crawled sources get an explicit value.
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS crawl_frequency_minutes INTEGER CHECK (crawl_frequency_minutes IS NULL OR crawl_frequency_minutes BETWEEN 5 AND 10080);
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS respect_robots_txt BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS category_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS article_url_patterns TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS parser_config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

-- Backfill last_success_at for feeds whose last poll succeeded, so the new
-- admin status column isn't blank for every existing source.
UPDATE feeds SET last_success_at = last_fetched_at
WHERE last_success_at IS NULL AND last_status IN ('ok', 'not_modified');

CREATE INDEX IF NOT EXISTS idx_articles_publisher_published ON articles (publisher_id, published_at DESC);
