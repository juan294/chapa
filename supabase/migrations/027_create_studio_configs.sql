-- Durable backing store for Creator Studio badge configurations.
-- Previously stored only in Redis (TTL 365 days), so eviction or a Redis
-- reset would permanently destroy the user's badge customization. This table
-- makes Supabase the source of truth; Redis remains the hot read path.
-- See issue #935.

CREATE TABLE IF NOT EXISTS studio_configs (
  handle TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE studio_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_configs FORCE ROW LEVEL SECURITY;

-- Defense-in-depth: deny anon role all access (consistent with supplemental_stats)
CREATE POLICY deny_anon_studio_configs ON studio_configs FOR ALL TO anon USING (false);
