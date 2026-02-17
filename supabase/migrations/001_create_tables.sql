-- Chapa: migrate permanent data from Redis to Supabase Postgres
-- See docs/supabase-migration-plan.md for full context.

-- ---------------------------------------------------------------------------
-- users — replaces Redis `user:registered:<handle>` keys
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_registered_at ON users (registered_at DESC);

-- ---------------------------------------------------------------------------
-- metrics_snapshots — replaces Redis `history:<handle>` sorted sets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle               TEXT NOT NULL,
  date                 DATE NOT NULL,
  captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Stats subset
  commits_total        INT NOT NULL,
  prs_merged_count     INT NOT NULL,
  prs_merged_weight    REAL NOT NULL,
  reviews_submitted    INT NOT NULL,
  issues_closed        INT NOT NULL,
  repos_contributed    INT NOT NULL,
  active_days          INT NOT NULL,
  lines_added          INT NOT NULL,
  lines_deleted        INT NOT NULL,
  total_stars          INT NOT NULL,
  total_forks          INT NOT NULL,
  total_watchers       INT NOT NULL,
  top_repo_share       REAL NOT NULL,

  -- Explanatory stats (optional)
  max_commits_in_10min INT,
  micro_commit_ratio   REAL,
  docs_only_pr_ratio   REAL,

  -- Impact dimensions & classification
  building             REAL NOT NULL,
  guarding             REAL NOT NULL,
  consistency          REAL NOT NULL,
  breadth              REAL NOT NULL,
  archetype            TEXT NOT NULL,
  profile_type         TEXT NOT NULL,
  composite_score      REAL NOT NULL,
  adjusted_composite   REAL NOT NULL,
  confidence           REAL NOT NULL,
  tier                 TEXT NOT NULL,

  -- Confidence penalties (JSONB array, null when empty)
  confidence_penalties JSONB,

  CONSTRAINT uq_snapshot_per_day UNIQUE (handle, date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_handle_date
  ON metrics_snapshots (handle, date DESC);

-- ---------------------------------------------------------------------------
-- verification_records — replaces Redis `verify:<hash>` + `verify-handle:<handle>`
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS verification_records (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hash                TEXT NOT NULL UNIQUE,
  handle              TEXT NOT NULL,
  display_name        TEXT,
  adjusted_composite  REAL NOT NULL,
  confidence          REAL NOT NULL,
  tier                TEXT NOT NULL,
  archetype           TEXT NOT NULL,
  profile_type        TEXT NOT NULL,
  building            REAL NOT NULL,
  guarding            REAL NOT NULL,
  consistency         REAL NOT NULL,
  breadth             REAL NOT NULL,
  commits_total       INT NOT NULL,
  prs_merged_count    INT NOT NULL,
  reviews_submitted   INT NOT NULL,
  generated_at        DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_verification_handle
  ON verification_records (handle);

CREATE INDEX IF NOT EXISTS idx_verification_expires
  ON verification_records (expires_at);
