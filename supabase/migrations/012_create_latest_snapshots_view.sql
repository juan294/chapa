-- View using DISTINCT ON for efficient "latest snapshot per user" queries.
-- The existing index idx_snapshots_handle_date (handle, date DESC) covers this.

CREATE OR REPLACE VIEW latest_snapshots AS
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
