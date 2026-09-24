/**
 * Supabase data access — admin dashboard queries.
 *
 * Queries the `admin_users_observed` view (#1335 phase 5 — the only
 * remaining policy; the pre-release view still computes a v6 CASE fallback
 * for subjects with no current receipt, but this module deliberately never
 * reads those fallback columns, only the `current_*` receipt projection, so
 * it is forward-compatible with the post-release contract migration that
 * rebuilds this view from `users` directly with no fallback at all).
 * All operations fail-open (return empty results when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRows } from "./parse-row";

// ---------------------------------------------------------------------------
// Row type (matches admin_users_observed view columns this module reads)
// ---------------------------------------------------------------------------

interface AdminUserRow {
  current_display_score?: number | null;
  current_exact_score?: number | null;
  current_tier?: string | null;
  current_archetype?: string | null;
  current_snapshot_date?: string | null;
  current_fetched_at?: string | null;
  current_revision_id?: string | null;
  current_content_hash?: string | null;
  handle: string;
  registered_at: string;
  display_name: string | null;
  avatar_url: string | null;
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
  policyVersion?: "v7.2";
  exactScore?: number | null;
  identity?: { revisionId: string; contentHash: string } | null;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  registeredAt: string;
  lastSnapshotDate: string | null;
  fetchedAt: string | null;
  archetype: string | null;
  tier: string | null;
  adjustedComposite: number | null;
  rawScore: number | null;
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

/** Sort columns on the current receipt projection. */
const SORT_COLUMN_MAP: Record<AdminSortField, string> = {
  handle: "handle",
  adjustedComposite: "current_display_score",
  rawScore: "current_display_score",
  tier: "current_tier",
  archetype: "current_archetype",
  registeredAt: "registered_at",
  lastSnapshotDate: "current_snapshot_date",
};

function mapSortField(field: AdminSortField): string {
  return SORT_COLUMN_MAP[field];
}

// ---------------------------------------------------------------------------
// Row → entry mapper
// ---------------------------------------------------------------------------

function rowToAdminUser(row: AdminUserRow): AdminUserEntry {
  const hasReceipt = row.current_revision_id != null && row.current_content_hash != null;

  return {
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? `https://avatars.githubusercontent.com/${row.handle}`,
    registeredAt: row.registered_at,
    lastSnapshotDate: hasReceipt ? row.current_snapshot_date ?? null : null,
    fetchedAt: hasReceipt ? row.current_fetched_at ?? null : null,
    archetype: hasReceipt ? row.current_archetype ?? null : null,
    tier: hasReceipt ? row.current_tier ?? null : null,
    adjustedComposite: hasReceipt ? row.current_display_score ?? null : null,
    rawScore: hasReceipt ? row.current_display_score ?? null : null,
    ...(hasReceipt && {
      policyVersion: "v7.2" as const,
      exactScore: row.current_exact_score ?? null,
      identity: { revisionId: row.current_revision_id!, contentHash: row.current_content_hash! },
    }),
  };
}

// ---------------------------------------------------------------------------
// Search term sanitization
// ---------------------------------------------------------------------------

/**
 * Escapes SQL ILIKE wildcard characters and the escape character itself so
 * user-supplied search terms cannot act as wildcards or bypass escaping.
 *
 * Escaped characters:
 *   \ → \\ (escape char must be doubled first to avoid double-escaping)
 *   % → \% (SQL wildcard: matches any sequence of characters)
 *   _ → \_ (SQL wildcard: matches any single character)
 *
 * Also strips PostgREST filter-string delimiter characters (,  .  (  )) to
 * prevent predicate injection when the term is later interpolated into a
 * PostgREST filter expression. GitHub handles and display names do not use
 * these characters in practice, so stripping is safe.
 */
function escapeIlike(term: string): string {
  return term
    .replace(/[\\%_]/g, "\\$&")
    .replace(/[,.()\s]/g, "");
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
 * Get paginated admin user data from the `admin_users_observed` view.
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
    let q = db.from("admin_users_observed").select("*", { count: "exact" });

    // Search filter: ILIKE on handle OR display_name. The term is run through
    // escapeIlike() first, which strips PostgREST filter-string delimiters
    // and escapes SQL wildcards, so it's safe to interpolate into .or().
    if (query.search?.trim()) {
      const term = escapeIlike(query.search.trim());
      q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
    }

    if (query.tier) q = q.eq("current_tier", query.tier);
    if (query.archetype) q = q.eq("current_archetype", query.archetype);

    const sortCol = mapSortField(query.sort);
    q = q.order(sortCol, {
      ascending: query.dir === "asc",
      nullsFirst: false,
    });
    if (query.sort !== "handle") q = q.order("handle", { ascending: true });

    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const total = count ?? 0;
    const rows = parseRows<AdminUserRow>(
      data,
      ADMIN_REQUIRED_KEYS,
      "admin_users_observed",
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
