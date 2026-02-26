/**
 * Supabase data access — admin dashboard queries.
 *
 * Queries the `admin_users` view (users LEFT JOIN latest_snapshots)
 * with server-side pagination, sorting, and filtering.
 * All operations fail-open (return empty results when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRows } from "./parse-row";

// ---------------------------------------------------------------------------
// Row type (matches admin_users view columns)
// ---------------------------------------------------------------------------

interface AdminUserRow {
  handle: string;
  registered_at: string;
  display_name: string | null;
  avatar_url: string | null;
  snapshot_date: string | null;
  snapshot_captured_at: string | null;
  commits_total: number | null;
  prs_merged_count: number | null;
  reviews_submitted: number | null;
  repos_contributed: number | null;
  active_days: number | null;
  total_stars: number | null;
  archetype: string | null;
  tier: string | null;
  adjusted_composite: number | null;
  composite_score: number | null;
  confidence: number | null;
  building: number | null;
  guarding: number | null;
  consistency_score: number | null;
  breadth: number | null;
}

const ADMIN_REQUIRED_KEYS: readonly (keyof AdminUserRow)[] = [
  "handle",
  "registered_at",
] as const;

// ---------------------------------------------------------------------------
// Query / result types
// ---------------------------------------------------------------------------

export type AdminSortField =
  | "handle"
  | "adjustedComposite"
  | "rawScore"
  | "confidence"
  | "commitsTotal"
  | "prsMergedCount"
  | "reviewsSubmittedCount"
  | "activeDays"
  | "totalStars"
  | "tier"
  | "archetype"
  | "registeredAt"
  | "lastSnapshotDate";

export interface AdminUserQuery {
  page: number;
  limit: number;
  sort: AdminSortField;
  dir: "asc" | "desc";
  search?: string;
  tier?: string;
  archetype?: string;
}

export interface AdminUserEntry {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  registeredAt: string;
  lastSnapshotDate: string | null;
  fetchedAt: string | null;
  commitsTotal: number | null;
  prsMergedCount: number | null;
  reviewsSubmittedCount: number | null;
  activeDays: number | null;
  reposContributed: number | null;
  totalStars: number | null;
  archetype: string | null;
  tier: string | null;
  adjustedComposite: number | null;
  rawScore: number | null;
  confidence: number | null;
}

export interface AdminUserResult {
  users: AdminUserEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Sort field → DB column mapping
// ---------------------------------------------------------------------------

const SORT_COLUMN_MAP: Record<AdminSortField, string> = {
  handle: "handle",
  adjustedComposite: "adjusted_composite",
  rawScore: "composite_score",
  confidence: "confidence",
  commitsTotal: "commits_total",
  prsMergedCount: "prs_merged_count",
  reviewsSubmittedCount: "reviews_submitted",
  activeDays: "active_days",
  totalStars: "total_stars",
  tier: "tier",
  archetype: "archetype",
  registeredAt: "registered_at",
  lastSnapshotDate: "snapshot_date",
};

function mapSortField(field: AdminSortField): string {
  return SORT_COLUMN_MAP[field] ?? "adjusted_composite";
}

// ---------------------------------------------------------------------------
// Row → entry mapper
// ---------------------------------------------------------------------------

function rowToAdminUser(row: AdminUserRow): AdminUserEntry {
  return {
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    registeredAt: row.registered_at,
    lastSnapshotDate: row.snapshot_date,
    fetchedAt: row.snapshot_captured_at,
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    reviewsSubmittedCount: row.reviews_submitted,
    activeDays: row.active_days,
    reposContributed: row.repos_contributed,
    totalStars: row.total_stars,
    archetype: row.archetype,
    tier: row.tier,
    adjustedComposite: row.adjusted_composite,
    rawScore: row.composite_score,
    confidence: row.confidence,
  };
}

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

const EMPTY_RESULT: AdminUserResult = {
  users: [],
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 0,
};

/**
 * Get paginated admin user data from the `admin_users` view.
 * Supports sorting, search (ILIKE on handle/display_name), and
 * tier/archetype filtering. Returns empty result on error (fail-open).
 */
export async function dbGetAdminUsers(
  query: AdminUserQuery,
): Promise<AdminUserResult> {
  const db = getSupabase();
  if (!db) return EMPTY_RESULT;

  // Clamp inputs
  const page = Math.max(1, query.page);
  const limit = Math.min(Math.max(1, query.limit), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let q = db.from("admin_users").select("*", { count: "exact" });

    // Search filter: ILIKE on handle or display_name
    if (query.search?.trim()) {
      const term = query.search.trim().replace(/%/g, "\\%");
      q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
    }

    // Tier filter
    if (query.tier) {
      q = q.eq("tier", query.tier);
    }

    // Archetype filter
    if (query.archetype) {
      q = q.eq("archetype", query.archetype);
    }

    // Sorting — nulls last for snapshot columns
    const sortCol = mapSortField(query.sort);
    q = q.order(sortCol, {
      ascending: query.dir === "asc",
      nullsFirst: false,
    });

    // Pagination
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const total = count ?? 0;
    const rows = parseRows<AdminUserRow>(
      data,
      ADMIN_REQUIRED_KEYS,
      "admin_users",
    );

    return {
      users: rows.map(rowToAdminUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("[db] dbGetAdminUsers failed:", (error as Error).message);
    return { users: [], total: 0, page, limit, totalPages: 0 };
  }
}
