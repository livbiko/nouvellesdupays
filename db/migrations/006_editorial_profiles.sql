-- Editorial Lens (Phase 1): editorial/political context is optional, sparse,
-- evidence-backed, and reviewed on its own cadence -- a different write
-- pattern than feed ingestion on `publishers`. A satellite 1:1 table keeps
-- publisher queries unchanged and matches the moderated-review pattern
-- already used by publisher_submissions/discovered_sources.

CREATE TABLE IF NOT EXISTS editorial_profiles (
  id                           SERIAL PRIMARY KEY,
  publisher_id                 INTEGER NOT NULL UNIQUE REFERENCES publishers(id),

  ownership_type                TEXT,
  owner                          TEXT,
  classification_tags            TEXT[] NOT NULL DEFAULT '{}'
    CHECK (classification_tags <@ ARRAY[
      'public_state', 'government_aligned', 'party_aligned', 'opposition_aligned',
      'independent', 'commercial_generalist', 'editorially_mixed', 'specialist', 'unknown'
    ]::TEXT[]),

  political_party_association    TEXT,
  historical_context              TEXT,
  current_context                  TEXT,

  confidence                    TEXT NOT NULL DEFAULT 'unknown'
    CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  evidence_summary                TEXT,
  evidence_sources                JSONB NOT NULL DEFAULT '[]',

  classification_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed                  DATE NOT NULL DEFAULT CURRENT_DATE,
  evidence_date                   DATE,
  review_required                 BOOLEAN NOT NULL DEFAULT false,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editorial_profiles_review ON editorial_profiles (review_required) WHERE review_required;

-- Reach/contact fields: operational, not editorial -- belong on publishers
-- itself alongside the existing homepage_url/domain/feed_status.
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS youtube_url   TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS tiktok_url    TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS facebook_url  TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS contact_email TEXT;
