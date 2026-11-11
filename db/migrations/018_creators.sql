-- Creator directory: YouTube / Facebook / TikTok creators and their rankings (2026-11-11, owner request: "Global
-- social media creator discovery, ranking & integration platform", sections 2, 4-6, 11-13, 15).
--
-- Builds on migration 016 instead of beside it: a creator's platform accounts are rows in social_accounts (one row per
-- account, whoever owns it - the unique (platform, url) index keeps a channel from existing twice, and an account can
-- belong to both a news publisher and a creator), and their numbers go to audience_metrics (append-only, provenance
-- per row). Numbers only come from an official API, the creator's own connected account, or a reviewer - never
-- estimated or scraped (spec sections 13, 14).
--
-- Additive only, idempotent (db/migrate.js re-runs every file): nothing existing is dropped, rewritten or deleted.
-- Reverse: ops/release-creators-schema/reverse.sql.

-- 1. Shared category taxonomy (spec section 4): seven groups, subcategories under them, one list for all platforms.
CREATE TABLE IF NOT EXISTS creator_categories (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  parent_slug  TEXT REFERENCES creator_categories(slug),
  name_en      TEXT NOT NULL,
  name_fr      TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

INSERT INTO creator_categories (slug, parent_slug, name_en, name_fr, sort_order) VALUES
  ('news-media',            NULL, 'News and Media',              'Actualités et médias',       10),
  ('entertainment',         NULL, 'Entertainment',               'Divertissement',             20),
  ('lifestyle',             NULL, 'Lifestyle',                   'Style de vie',               30),
  ('education-knowledge',   NULL, 'Education and Knowledge',     'Éducation et savoir',        40),
  ('sports',                NULL, 'Sports',                      'Sports',                     50),
  ('culture-society',       NULL, 'Culture and Society',         'Culture et société',         60),
  ('digital-gaming',        NULL, 'Digital and Gaming',          'Numérique et jeux vidéo',    70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO creator_categories (slug, parent_slug, name_en, name_fr, sort_order) VALUES
  ('news-current-affairs',  'news-media', 'News and Current Affairs',   'Actualité',                    11),
  ('journalism',            'news-media', 'Journalism',                 'Journalisme',                  12),
  ('politics',              'news-media', 'Politics',                   'Politique',                    13),
  ('investigative',         'news-media', 'Investigative Journalism',   'Journalisme d''investigation', 14),
  ('tv-radio',              'news-media', 'Television and Radio',       'Télévision et radio',          15),
  ('independent-media',     'news-media', 'Independent Media',          'Médias indépendants',          16),
  ('international-affairs', 'news-media', 'International Affairs',      'Affaires internationales',     17),
  ('comedy',                'entertainment', 'Comedy',                  'Comédie',                      21),
  ('movies-cinema',         'entertainment', 'Movies and Cinema',       'Films et cinéma',              22),
  ('music',                 'entertainment', 'Music',                   'Musique',                      23),
  ('dance',                 'entertainment', 'Dance',                   'Danse',                        24),
  ('celebrity-news',        'entertainment', 'Celebrity News',          'People',                       25),
  ('entertainment-shows',   'entertainment', 'Entertainment Shows',     'Émissions de divertissement',  26),
  ('fashion',               'lifestyle', 'Fashion',                     'Mode',                         31),
  ('beauty',                'lifestyle', 'Beauty',                      'Beauté',                       32),
  ('travel',                'lifestyle', 'Travel',                      'Voyage',                       33),
  ('food-cooking',          'lifestyle', 'Food and Cooking',            'Cuisine',                      34),
  ('family-relationships',  'lifestyle', 'Family and Relationships',    'Famille et relations',         35),
  ('personal-development',  'lifestyle', 'Personal Development',        'Développement personnel',      36),
  ('education',             'education-knowledge', 'Education',         'Éducation',                    41),
  ('science',               'education-knowledge', 'Science',           'Sciences',                     42),
  ('history',               'education-knowledge', 'History',           'Histoire',                     43),
  ('business-finance',      'education-knowledge', 'Business and Finance', 'Affaires et finance',       44),
  ('entrepreneurship',      'education-knowledge', 'Entrepreneurship',  'Entrepreneuriat',              45),
  ('languages',             'education-knowledge', 'Languages',         'Langues',                      46),
  ('football',              'sports', 'Football',                       'Football',                     51),
  ('basketball',            'sports', 'Basketball',                     'Basketball',                   52),
  ('athletics',             'sports', 'Athletics',                      'Athlétisme',                   53),
  ('boxing-combat',         'sports', 'Boxing and Combat Sports',       'Boxe et sports de combat',     54),
  ('sports-commentary',     'sports', 'Sports Commentary',              'Commentaire sportif',          55),
  ('other-sports',          'sports', 'Other Sports',                   'Autres sports',                56),
  ('african-culture',       'culture-society', 'African Culture',       'Culture africaine',            61),
  ('traditional-culture',   'culture-society', 'Traditional Culture',   'Culture traditionnelle',       62),
  ('religion-spirituality', 'culture-society', 'Religion and Spirituality', 'Religion et spiritualité', 63),
  ('community',             'culture-society', 'Community',             'Communauté',                   64),
  ('social-issues',         'culture-society', 'Social Issues',         'Questions sociales',           65),
  ('diaspora',              'culture-society', 'Diaspora',              'Diaspora',                     66),
  ('gaming',                'digital-gaming', 'Gaming',                 'Jeux vidéo',                   71),
  ('technology',            'digital-gaming', 'Technology and Reviews', 'Technologie et tests',         72),
  ('digital-marketing',     'digital-gaming', 'Digital Marketing and Social Media', 'Marketing numérique et réseaux sociaux', 73),
  ('artificial-intelligence', 'digital-gaming', 'Artificial Intelligence', 'Intelligence artificielle', 74),
  ('software-programming',  'digital-gaming', 'Software and Programming', 'Logiciels et programmation',  75)
ON CONFLICT (slug) DO NOTHING;

-- 2. creators: a person or brand. Nothing is public until a reviewer approves it (review_status 'approved').
--    confidence follows spec section 13; a candidate starts REQUIRES_REVIEW. possible_minor keeps a profile out of
--    every public list until a reviewer has looked at it (spec section 13: particular care for minors).
CREATE TABLE IF NOT EXISTS creators (
  id                SERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  country_id        INTEGER REFERENCES countries(id),
  languages         TEXT[] NOT NULL DEFAULT '{}',
  bio               TEXT,                        -- short public professional description only
  official_website  TEXT,
  creator_kind      TEXT NOT NULL DEFAULT 'individual' CHECK (creator_kind IN ('individual', 'group', 'media_brand')),
  publisher_id      INTEGER REFERENCES publishers(id),   -- when the creator is also one of our news publishers
  confidence        TEXT NOT NULL DEFAULT 'REQUIRES_REVIEW'
                    CHECK (confidence IN ('VERIFIED', 'HIGH_CONFIDENCE', 'PROVISIONAL', 'REQUIRES_REVIEW')),
  review_status     TEXT NOT NULL DEFAULT 'candidate' CHECK (review_status IN ('candidate', 'approved', 'rejected', 'merged')),
  merged_into_id    INTEGER REFERENCES creators(id),
  possible_minor    BOOLEAN NOT NULL DEFAULT false,
  discovered_from   TEXT,                        -- agent / search / owner list that produced the candidate
  reviewer_note     TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((review_status = 'merged') = (merged_into_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_creators_country ON creators (country_id, review_status);
CREATE INDEX IF NOT EXISTS idx_creators_name ON creators (lower(display_name));

CREATE TABLE IF NOT EXISTS creator_category_links (
  creator_id   INTEGER NOT NULL REFERENCES creators(id),
  category_id  INTEGER NOT NULL REFERENCES creator_categories(id),
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (creator_id, category_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_category_primary ON creator_category_links (creator_id) WHERE is_primary;

-- 3. social_accounts: may now belong to a creator. Public profile fields as the platform shows them; platform_verified
--    is the platform's own badge (NULL = not known), separate from our verification of who owns the account.
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES creators(id);
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS platform_verified BOOLEAN;
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_check;
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_owner_check;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_owner_check
  CHECK (publisher_id IS NOT NULL OR discovered_source_id IS NOT NULL OR creator_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_social_accounts_creator ON social_accounts (creator_id) WHERE creator_id IS NOT NULL;

-- 4. audience_metrics: the metrics the three platforms expose, and where they may come from. window_days says what
--    period a "recent" number covers, so growth compares like with like. engagement_rate_bp = basis points (1 = 0.01 %)
--    because value is an integer.
ALTER TABLE audience_metrics ADD COLUMN IF NOT EXISTS window_days SMALLINT CHECK (window_days > 0);
ALTER TABLE audience_metrics DROP CONSTRAINT IF EXISTS audience_metrics_metric_check;
ALTER TABLE audience_metrics ADD CONSTRAINT audience_metrics_metric_check CHECK (metric IN (
  'subscribers', 'followers', 'total_views', 'video_count', 'avg_recent_views', 'recent_uploads_30d',
  'page_likes', 'total_likes', 'recent_views', 'engagement_rate_bp', 'recent_posts'));
ALTER TABLE audience_metrics DROP CONSTRAINT IF EXISTS audience_metrics_source_check;
ALTER TABLE audience_metrics ADD CONSTRAINT audience_metrics_source_check CHECK (source IN (
  'youtube_data_api', 'reviewer', 'meta_graph_api', 'tiktok_api', 'creator_connected'));

-- 5. Identity evidence (spec section 6): why we believe an account belongs to a creator. Append-only; a name match on
--    its own is recorded as weak evidence and never merges accounts by itself.
CREATE TABLE IF NOT EXISTS creator_verifications (
  id                 BIGSERIAL PRIMARY KEY,
  creator_id         INTEGER NOT NULL REFERENCES creators(id),
  social_account_id  INTEGER REFERENCES social_accounts(id),
  evidence_kind      TEXT NOT NULL CHECK (evidence_kind IN ('platform_badge', 'cross_link', 'official_website',
                       'creator_confirmed', 'reviewer', 'name_match_only', 'impersonator_suspected')),
  evidence_url       TEXT,
  note               TEXT,
  recorded_by        TEXT NOT NULL,              -- agent name or admin user
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_verifications_creator ON creator_verifications (creator_id, created_at DESC);

-- 6. Agents, jobs and runs (spec sections 2, 11, 15). No credentials here: API keys stay in the Kubernetes secret.
CREATE TABLE IF NOT EXISTS discovery_agents (
  agent              TEXT PRIMARY KEY CHECK (agent IN ('youtube', 'facebook', 'tiktok', 'global')),
  paused             BOOLEAN NOT NULL DEFAULT true,          -- every agent starts paused; an admin starts it
  paused_reason      TEXT,
  daily_quota_units  INTEGER NOT NULL DEFAULT 0 CHECK (daily_quota_units >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT
);
INSERT INTO discovery_agents (agent, paused, paused_reason, daily_quota_units) VALUES
  ('youtube',  true, 'not started (needs YOUTUBE_API_KEY)', 8000),
  ('facebook', true, 'no Meta page-data access', 0),
  ('tiktok',   true, 'no eligible TikTok API access', 0),
  ('global',   true, 'not started', 0)
ON CONFLICT (agent) DO NOTHING;

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id                BIGSERIAL PRIMARY KEY,
  agent             TEXT NOT NULL REFERENCES discovery_agents(agent),
  job_type          TEXT NOT NULL CHECK (job_type IN ('discover', 'refresh_metrics', 'verify', 'rank', 'coverage', 'report')),
  country_id        INTEGER REFERENCES countries(id),
  params            JSONB NOT NULL DEFAULT '{}',
  idempotency_key   TEXT NOT NULL UNIQUE,                  -- e.g. 'youtube:discover:CI:2026-11-12'
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,
  next_run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkpoint        JSONB,                                 -- resume point (e.g. page token) after an interruption
  locked_by         TEXT,
  locked_at         TIMESTAMPTZ,
  quota_units_used  INTEGER NOT NULL DEFAULT 0,
  result            JSONB,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_queue ON discovery_jobs (agent, next_run_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS agent_runs (
  id               BIGSERIAL PRIMARY KEY,
  agent            TEXT NOT NULL REFERENCES discovery_agents(agent),
  job_id           BIGINT REFERENCES discovery_jobs(id),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed', 'skipped')),
  items_seen       INTEGER NOT NULL DEFAULT 0,
  items_new        INTEGER NOT NULL DEFAULT 0,
  quota_units      INTEGER NOT NULL DEFAULT 0,
  message          TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs (agent, started_at DESC);

-- 7. Rankings (spec section 5): weights per platform, configurable; each computation is kept (history), with the
--    inputs it used and which metrics were missing, so a missing number is visible rather than silently zero.
CREATE TABLE IF NOT EXISTS creator_ranking_weights (
  platform     TEXT PRIMARY KEY CHECK (platform IN ('youtube', 'facebook', 'tiktok')),
  popularity   NUMERIC(5,2) NOT NULL,
  engagement   NUMERIC(5,2) NOT NULL,
  content      NUMERIC(5,2) NOT NULL,
  growth       NUMERIC(5,2) NOT NULL,
  activity     NUMERIC(5,2) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (popularity + engagement + content + growth + activity = 100)
);
INSERT INTO creator_ranking_weights (platform, popularity, engagement, content, growth, activity) VALUES
  ('youtube', 25, 25, 25, 15, 10), ('facebook', 25, 25, 25, 15, 10), ('tiktok', 25, 25, 25, 15, 10)
ON CONFLICT (platform) DO NOTHING;

CREATE TABLE IF NOT EXISTS creator_rankings (
  id                 BIGSERIAL PRIMARY KEY,
  computed_at        TIMESTAMPTZ NOT NULL,
  platform           TEXT NOT NULL CHECK (platform IN ('youtube', 'facebook', 'tiktok')),
  scope              TEXT NOT NULL CHECK (scope IN ('country', 'category', 'region', 'africa', 'global')),
  scope_key          TEXT NOT NULL DEFAULT '',             -- ISO code, category slug or region name; '' for africa/global
  dimension          TEXT NOT NULL CHECK (dimension IN ('overall', 'popularity', 'engagement', 'content', 'growth', 'activity')),
  creator_id         INTEGER NOT NULL REFERENCES creators(id),
  social_account_id  INTEGER NOT NULL REFERENCES social_accounts(id),
  rank               INTEGER NOT NULL CHECK (rank > 0),
  score              NUMERIC(6,2) NOT NULL,
  inputs             JSONB NOT NULL                        -- metrics used, metrics missing, weights applied
);
CREATE INDEX IF NOT EXISTS idx_creator_rankings_lookup ON creator_rankings (platform, scope, scope_key, dimension, computed_at DESC, rank);
