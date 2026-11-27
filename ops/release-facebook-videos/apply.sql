-- CR-2026-11-27-01: migration 023 on production (additive: a new table; the running code ignores it).
SET lock_timeout = '10s';
BEGIN;
-- CR-2026-11-27-01: the /facebook page. Every video is entered by an admin on /admin/facebook (our servers never open
-- facebook.com: the link's form is checked, nothing is fetched). The thumbnail is optional and uploaded by the admin
-- (stored here, served by the API). review_status 'hidden' takes a video off the public page without deleting it.
-- New table only; re-runs are no-ops.
CREATE TABLE IF NOT EXISTS facebook_videos (
  id              SERIAL PRIMARY KEY,
  url             text NOT NULL UNIQUE,     -- https://www.facebook.com/... or https://fb.watch/... (checked by the API)
  title           text NOT NULL,
  page_name       text NOT NULL,            -- the Facebook page or profile that published it
  page_url        text,
  published_at    timestamptz NOT NULL,
  country_id      integer REFERENCES countries(id),
  category_slug   text REFERENCES creator_categories(slug),
  type            text,                     -- a /youtube type key (youtubeDirectory.js TYPES), e.g. createur-independant
  language        text,                     -- fr, en, ar, pt, es, sw
  thumbnail       bytea,
  thumbnail_type  text,                     -- image/jpeg, image/png or image/webp
  added_by        text NOT NULL DEFAULT 'admin',
  review_status   text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved', 'hidden')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_videos_published_idx ON facebook_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS facebook_videos_country_idx ON facebook_videos (country_id);
COMMIT;
SELECT to_regclass('facebook_videos') AS table_now, (SELECT count(*) FROM facebook_videos) AS rows;
