-- Migration: 007_create_merge_operations
-- Description: Table for CLI merge telemetry data (chapa-cli v0.3.1+)
-- Date: 2026-02-18

CREATE TABLE merge_operations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id UUID NOT NULL UNIQUE,
  target_handle TEXT NOT NULL,
  source_handle TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_category TEXT,
  commits_total INT NOT NULL,
  repos_contributed INT NOT NULL,
  prs_merged_count INT NOT NULL,
  active_days INT NOT NULL,
  reviews_submitted_count INT NOT NULL,
  fetch_ms INT NOT NULL,
  upload_ms INT NOT NULL,
  total_ms INT NOT NULL,
  cli_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query pattern: "show merge history for a handle, newest first"
CREATE INDEX idx_merge_ops_handle_created
  ON merge_operations (target_handle, created_at DESC);

-- Query pattern: "find failed merges for debugging"
CREATE INDEX idx_merge_ops_failed
  ON merge_operations (created_at DESC)
  WHERE success = false;

-- RLS: server-side only (service role key bypasses RLS)
ALTER TABLE merge_operations ENABLE ROW LEVEL SECURITY;
