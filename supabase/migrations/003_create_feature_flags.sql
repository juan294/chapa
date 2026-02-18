-- Feature flags table for DB-backed feature toggles.
-- Replaces env-var based feature flags with a unified system.
-- Refs: scheduled-agents-admin-panel plan, Issue #412

CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  description TEXT,
  config      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow public reads (feature flags are not sensitive)
CREATE POLICY "feature_flags_read_all" ON feature_flags FOR SELECT USING (true);

-- Seed: master toggle + per-agent flags + migrated existing flags
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('automated_agents', false, 'Master toggle for all scheduled agents'),
  ('coverage_agent', true, 'Daily test coverage report agent'),
  ('security_scanner', true, 'Weekly security audit agent'),
  ('qa_agent', true, 'Weekly QA and accessibility report agent'),
  ('studio_enabled', false, 'Creator Studio feature'),
  ('experiments_enabled', false, 'Experiments pages feature');
