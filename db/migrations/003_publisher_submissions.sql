-- Self-service publisher/feed registration: submissions land here, fully
-- separate from the live publishers/feeds tables, and only get copied over
-- on manual approval (see db/review-submissions.js). country_id references
-- the existing countries table so submitters pick from the real 190, not
-- free text.

CREATE TABLE IF NOT EXISTS publisher_submissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  country_id INTEGER NOT NULL REFERENCES countries(id),
  language TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  feed_verified BOOLEAN NOT NULL,
  verification_detail TEXT,
  reviewer_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_publisher_submissions_status ON publisher_submissions (status, submitted_at);
