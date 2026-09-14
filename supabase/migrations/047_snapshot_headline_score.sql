-- 047 — record the number the badge actually shows.
--
-- `adjusted_composite` holds the EMA-smoothed composite: it exists so the
-- history sparkline stays smooth and tomorrow's prior is stable (#1001). The
-- badge, share page and dashboard all draw the *fresh* adjusted composite
-- instead, so any surface reading a snapshot published a number the user
-- could not find on their own profile — the landing leaderboard made that
-- visible (79 on the board, 80 on the badge, same handle, same minute).
--
-- Nullable and unbackfilled on purpose: an older row genuinely does not know
-- what its headline was, and a reader falls back to `adjusted_composite`
-- rather than inventing one.
alter table metrics_snapshots
  add column if not exists headline_score integer;

comment on column metrics_snapshots.headline_score is
  'The fresh adjusted composite shown on the badge for this capture. adjusted_composite is the EMA-smoothed value kept for trend continuity.';
