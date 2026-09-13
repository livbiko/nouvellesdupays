-- Phase A of the News Acquisition & Partnership Co-worker: schema
-- extension only, no new service yet. Adds source classification +
-- compliance fields to the existing publishers table, plus new tables for
-- the parts of the DISCOVER->CONTACT->INVITE pipeline that don't exist yet
-- (contacts, invitations, source_scores) and a staging table for
-- proactively-discovered sources that sits upstream of the existing
-- publisher_submissions table -- discovered_sources is for candidates the
-- Co-worker found on its own, before a human decides one is worth turning
-- into an actual publisher_submissions row (or before a publisher
-- self-registers, in which case it skips this table entirely, same as
-- today).
--
-- Idempotent like every migration here (db/migrate.js re-runs all files
-- unconditionally, no migration-tracking table) -- IF NOT EXISTS / DO
-- blocks throughout.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publishers' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE publishers ADD COLUMN source_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (source_type IN (
      'NEWS_AGENCY', 'NEWSPAPER', 'TV', 'RADIO', 'MAGAZINE', 'ONLINE_NEWS',
      'INVESTIGATIVE', 'BLOG', 'JOURNALIST', 'YOUTUBE_NEWS', 'PODCAST',
      'SOCIAL_NEWS', 'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publishers' AND column_name = 'terms_url'
  ) THEN
    ALTER TABLE publishers ADD COLUMN terms_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publishers' AND column_name = 'license_status'
  ) THEN
    -- unclear = default, deliberately conservative: nothing should treat a
    -- publisher as fully rights-clear just because it was auto-approved for
    -- feed ingestion (feed_status='active') -- that only means the feed
    -- technically works, not that licensing/attribution terms are settled.
    ALTER TABLE publishers ADD COLUMN license_status TEXT NOT NULL DEFAULT 'unclear' CHECK (license_status IN (
      'unclear', 'headline_excerpt_only', 'licensed_full_content', 'partnership_agreed'
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publishers' AND column_name = 'attribution_required'
  ) THEN
    ALTER TABLE publishers ADD COLUMN attribution_required BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Sources the Co-worker (or a human) found proactively, before they become
-- a publisher_submissions row. Deliberately NOT reusing
-- publisher_submissions for this stage: that table's shape (feed_url NOT
-- NULL, feed_verified NOT NULL) assumes a feed has already been found and
-- verified, which is exactly what discovery hasn't established yet for a
-- freshly-discovered candidate.
CREATE TABLE IF NOT EXISTS discovered_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  country_id INTEGER REFERENCES countries(id),
  source_type TEXT CHECK (source_type IN (
    'NEWS_AGENCY', 'NEWSPAPER', 'TV', 'RADIO', 'MAGAZINE', 'ONLINE_NEWS',
    'INVESTIGATIVE', 'BLOG', 'JOURNALIST', 'YOUTUBE_NEWS', 'PODCAST',
    'SOCIAL_NEWS', 'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER'
  )),
  language TEXT,
  discovery_method TEXT, -- e.g. 'search_api', 'media_directory', 'manual', 'referral'
  discovery_query TEXT,  -- the search query or directory/source that surfaced this candidate
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'under_review', 'verified', 'contacted', 'invited',
    'registered', 'rejected'
  )),
  notes TEXT,
  promoted_submission_id INTEGER REFERENCES publisher_submissions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (homepage_url)
);

CREATE INDEX IF NOT EXISTS idx_discovered_sources_status ON discovered_sources (status, country_id);

-- Contact people for a publisher or a discovered source -- one entity can
-- have more than one contact over time (a submission's single
-- contact_email field stays as-is, unchanged, for the existing
-- self-service flow).
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  discovered_source_id INTEGER REFERENCES discovered_sources(id),
  publisher_id INTEGER REFERENCES publishers(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (discovered_source_id IS NOT NULL OR publisher_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_contacts_discovered_source ON contacts (discovered_source_id);
CREATE INDEX IF NOT EXISTS idx_contacts_publisher ON contacts (publisher_id);

-- One row per outreach attempt. channel/status are deliberately narrow to
-- what Phase D (human-approved single-channel outreach) actually needs --
-- widen the CHECK list when WhatsApp/LinkedIn/etc. outreach is actually
-- built, not speculatively now.
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  discovered_source_id INTEGER REFERENCES discovered_sources(id),
  contact_id INTEGER REFERENCES contacts(id),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'contact_form', 'linkedin', 'facebook', 'x')),
  template_used TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'awaiting_approval', 'approved', 'sent', 'opened', 'replied',
    'bounced', 'opted_out', 'rejected_by_reviewer'
  )),
  approved_by TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_discovered_source ON invitations (discovered_source_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations (status);

-- Explainable scoring: score_breakdown stores the per-factor contribution
-- so "why is this 74/100" always has a real answer, not just a number.
-- One row per scoring RUN (not one row per source) -- re-scoring over time
-- is a feature (freshness/reliability drift), not an update-in-place.
CREATE TABLE IF NOT EXISTS source_scores (
  id SERIAL PRIMARY KEY,
  discovered_source_id INTEGER REFERENCES discovered_sources(id),
  publisher_id INTEGER REFERENCES publishers(id),
  total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  score_breakdown JSONB NOT NULL, -- { authority: 12, credibility: 8, geographic_relevance: 15, ... }
  score_band TEXT NOT NULL CHECK (score_band IN ('low', 'moderate', 'good', 'high', 'priority')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (discovered_source_id IS NOT NULL OR publisher_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_source_scores_discovered_source ON source_scores (discovered_source_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_scores_publisher ON source_scores (publisher_id, computed_at DESC);
