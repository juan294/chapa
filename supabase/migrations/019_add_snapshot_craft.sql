-- Add craft dimension to metrics_snapshots.
-- Nullable because legacy rows and users without AI tool insights won't have it.
ALTER TABLE metrics_snapshots ADD COLUMN IF NOT EXISTS craft REAL;
