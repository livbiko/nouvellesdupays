CREATE TABLE IF NOT EXISTS countries (
  id            SERIAL PRIMARY KEY,
  iso_code      CHAR(2) NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  region        TEXT NOT NULL,
  capital       TEXT,
  population    BIGINT,
  languages     TEXT[] NOT NULL DEFAULT '{}',
  timezone      TEXT,
  flag_url      TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publishers (
  id            SERIAL PRIMARY KEY,
  country_id    INTEGER NOT NULL REFERENCES countries(id),
  name          TEXT NOT NULL,
  homepage_url  TEXT NOT NULL,
  logo_url      TEXT,
  feed_status   TEXT NOT NULL DEFAULT 'pending' CHECK (feed_status IN ('active', 'unavailable', 'pending')),
  language      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);

CREATE TABLE IF NOT EXISTS feeds (
  id              SERIAL PRIMARY KEY,
  publisher_id    INTEGER NOT NULL REFERENCES publishers(id),
  feed_url        TEXT NOT NULL UNIQUE,
  feed_type       TEXT NOT NULL DEFAULT 'rss' CHECK (feed_type IN ('rss', 'atom')),
  last_fetched_at TIMESTAMPTZ,
  last_status     TEXT,
  etag            TEXT,
  last_modified   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id            SERIAL PRIMARY KEY,
  feed_id       INTEGER NOT NULL REFERENCES feeds(id),
  publisher_id  INTEGER NOT NULL REFERENCES publishers(id),
  country_id    INTEGER NOT NULL REFERENCES countries(id),
  headline      TEXT NOT NULL,
  summary       TEXT,
  image_url     TEXT,
  original_url  TEXT NOT NULL,
  author        TEXT,
  category      TEXT NOT NULL DEFAULT 'other',
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedup_hash    TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_articles_country_published ON articles (country_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_publisher ON feeds (publisher_id);
CREATE INDEX IF NOT EXISTS idx_publishers_country ON publishers (country_id);
