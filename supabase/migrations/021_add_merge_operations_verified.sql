-- Add an explicit verification flag for merge telemetry rows.
-- Phase 3 keeps /api/telemetry unauthenticated, so new rows default to verified=false
-- until the CLI starts presenting a bearer token in a follow-up phase.

ALTER TABLE merge_operations
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_merge_operations_handle_verified_created
  ON merge_operations (target_handle, verified, created_at DESC);
