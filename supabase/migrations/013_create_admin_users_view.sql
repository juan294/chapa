-- Admin dashboard view: users LEFT JOIN their latest snapshot.
-- Users without any snapshot still appear (LEFT JOIN) with null metric fields.
-- Sortable and filterable via Supabase SDK (.from("admin_users")).

CREATE OR REPLACE VIEW admin_users AS
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
