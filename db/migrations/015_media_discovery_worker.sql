-- Media discovery worker (apps/worker/src/discover.js): turns
-- discovered_sources (migration 005, empty until now) into a real candidate
-- queue. The worker finds candidates, checks them (robots.txt, homepage,
-- feed / news sitemap, social links, freshness, spam/hijack signals), scores
-- them into source_scores, and leaves them for a human: nothing becomes a
-- publisher without an admin promoting it into publisher_submissions and
-- approving it there, exactly like a self-registered publisher.
--
-- Additive only, idempotent (db/migrate.js re-runs every file).

ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS domain TEXT;
UPDATE discovered_sources
SET domain = lower(regexp_replace(regexp_replace(regexp_replace(homepage_url, '^https?://', ''), '^www\.', ''), '[/:?#].*$', ''))
WHERE domain IS NULL;
-- The duplicate key: one candidate per site, however many times it is found.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_sources_domain ON discovered_sources (domain);

ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS site_title TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS html_lang TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS http_status INTEGER;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS final_url TEXT;

-- Ingestion route found by the check: feed_type follows feeds.feed_type
-- ('rss'/'atom'/'sitemap-news'/'sitemap'); NULL feed_url = no feed found,
-- the site can still be onboarded as a crawled ('html') source.
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS feed_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS feed_type TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS sitemap_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS item_count INTEGER;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS latest_item_at TIMESTAMPTZ;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS article_link_count INTEGER;

-- Official accounts as linked from the site itself (never searched for).
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS x_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS creator_kind TEXT NOT NULL DEFAULT 'organisation';
ALTER TABLE discovered_sources DROP CONSTRAINT IF EXISTS discovered_sources_creator_kind_check;
ALTER TABLE discovered_sources ADD CONSTRAINT discovered_sources_creator_kind_check
  CHECK (creator_kind IN ('organisation', 'individual'));

-- Neutral labels, set by a human from evidence; never used to filter out.
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS editorial_orientation TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE discovered_sources DROP CONSTRAINT IF EXISTS discovered_sources_editorial_orientation_check;
ALTER TABLE discovered_sources ADD CONSTRAINT discovered_sources_editorial_orientation_check
  CHECK (editorial_orientation IN ('unknown', 'public', 'state_affiliated', 'commercial', 'independent',
    'political', 'community', 'religious', 'investigative'));

-- Technical health from the last check, separate from the review status.
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS health TEXT NOT NULL DEFAULT 'unchecked';
ALTER TABLE discovered_sources DROP CONSTRAINT IF EXISTS discovered_sources_health_check;
ALTER TABLE discovered_sources ADD CONSTRAINT discovered_sources_health_check
  CHECK (health IN ('unchecked', 'ok', 'unreachable', 'dead', 'blocked_by_robots', 'spam_suspect', 'not_news'));

ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS discovered_from TEXT;           -- evidence: the page that linked to it
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS discovered_from_publisher_id INTEGER REFERENCES publishers(id);
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS times_seen INTEGER NOT NULL DEFAULT 1;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS check_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_discovered_sources_due ON discovered_sources (next_check_at NULLS FIRST)
  WHERE status IN ('discovered', 'under_review');

-- Which publisher homepages have been mined for outbound links, and when --
-- lets each run pick up where the last one stopped instead of re-fetching
-- the same homepages.
CREATE TABLE IF NOT EXISTS discovery_mining_log (
  publisher_id INTEGER PRIMARY KEY REFERENCES publishers(id),
  mined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  links_found INTEGER NOT NULL DEFAULT 0,
  candidates_added INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
