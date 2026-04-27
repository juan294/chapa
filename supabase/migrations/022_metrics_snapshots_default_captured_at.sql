ALTER TABLE metrics_snapshots
  ALTER COLUMN captured_at SET DEFAULT now();
