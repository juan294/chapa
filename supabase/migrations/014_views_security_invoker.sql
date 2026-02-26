-- Fix Security Advisor warnings: make views use SECURITY INVOKER
-- so they respect the caller's permissions instead of the view owner's.

-- Recreate latest_snapshots with security_invoker
CREATE OR REPLACE VIEW latest_snapshots
WITH (security_invoker = true) AS
SELECT DISTINCT ON (handle)
  handle,
  date,
  captured_at,
  commits_total,
  prs_merged_count,
  reviews_submitted,
  issues_closed,
  repos_contributed,
  active_days,
  lines_added,
  lines_deleted,
  total_stars,
  total_forks,
  total_watchers,
  top_repo_share,
  building,
  guarding,
  consistency,
  breadth,
  archetype,
  profile_type,
  composite_score,
  adjusted_composite,
  confidence,
  tier
FROM metrics_snapshots
ORDER BY handle, date DESC;

-- Recreate admin_users with security_invoker
CREATE OR REPLACE VIEW admin_users
WITH (security_invoker = true) AS
SELECT
  u.handle,
  u.registered_at,
  u.display_name,
  u.avatar_url,
  ls.date          AS snapshot_date,
  ls.captured_at   AS snapshot_captured_at,
  ls.commits_total,
  ls.prs_merged_count,
  ls.reviews_submitted,
  ls.repos_contributed,
  ls.active_days,
  ls.total_stars,
  ls.archetype,
  ls.tier,
  ls.adjusted_composite,
  ls.composite_score,
  ls.confidence,
  ls.building,
  ls.guarding,
  ls.consistency   AS consistency_score,
  ls.breadth
FROM users u
LEFT JOIN latest_snapshots ls ON ls.handle = u.handle;
