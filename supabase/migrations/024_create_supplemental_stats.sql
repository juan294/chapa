-- Persist supplemental stats (typically EMU/work-account uploads from the CLI).
-- Previously these lived only in Redis with a 24h TTL, so a missed upload day
-- silently dropped the work-account contribution from scores. This table is
-- the durable source; Redis remains the hot read path. See issue #825.

CREATE TABLE IF NOT EXISTS supplemental_stats (
  target_handle TEXT PRIMARY KEY,
  source_handle TEXT NOT NULL,
  stats JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplemental_stats_uploaded_at
  ON supplemental_stats (uploaded_at DESC);

ALTER TABLE supplemental_stats ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: deny anon role all access (consistent with 008_add_rls_deny_policies)
CREATE POLICY deny_anon_supplemental_stats ON supplemental_stats FOR ALL TO anon USING (false);
