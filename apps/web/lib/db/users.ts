/**
 * Supabase data access — users table.
 *
 * Replaces Redis `user:registered:<handle>` keys.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRows } from "./parse-row";
import { fetchAllPages } from "./paginate";

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface UserRow {
  handle: string;
  registered_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

const USER_REQUIRED_KEYS: readonly (keyof UserRow)[] = [
  "handle",
  "registered_at",
] as const;

interface UpsertUserOpts {
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Register a user (upsert — idempotent).
 * Handles are stored lowercase for consistent lookups.
 *
 * When any profile field is provided, updates the existing row
 * (ignoreDuplicates: false). Without extra fields, existing rows
 * are left untouched.
 */
export async function dbUpsertUser(
  handle: string,
  opts?: UpsertUserOpts,
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const row: Record<string, string | null> = { handle: handle.toLowerCase() };
    if (opts?.email) row.email = opts.email;
    if (opts?.displayName !== undefined) row.display_name = opts.displayName;
    if (opts?.avatarUrl !== undefined) row.avatar_url = opts.avatarUrl;

    const hasUpdateFields =
      opts?.email ||
      opts?.displayName !== undefined ||
      opts?.avatarUrl !== undefined;

    await db
      .from("users")
      .upsert(row, {
        onConflict: "handle",
        // When we have new data, update the existing row.
        // Without extra fields, skip duplicates to preserve existing data.
        ignoreDuplicates: !hasUpdateFields,
      });
  } catch (error) {
    console.error("[db] dbUpsertUser failed:", (error as Error).message);
  }
}

/**
 * Get registered users, ordered by registration date (newest first).
 *
 * With `opts.limit`, returns a single explicit page (caller-controlled,
 * e.g. an admin UI page). Without it, returns EVERY registered user —
 * PostgREST caps any single unpaginated select at `max_rows` (1000,
 * supabase/config.toml:18), so this pages through with `.range()` via
 * `fetchAllPages` rather than silently truncating (#1079). Callers of the
 * no-opts form (warm-cache cron, bulk-recalculate) rely on seeing every
 * registered user, including the earliest registrants past row 1000.
 *
 * Returns empty array when DB is unavailable.
 */
export async function dbGetUsers(
  opts?: { limit?: number; offset?: number },
): Promise<{ handle: string; registeredAt: string; displayName: string | null; avatarUrl: string | null }[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const baseQuery = () =>
      db
        .from("users")
        .select("handle, registered_at, display_name, avatar_url")
        .order("registered_at", { ascending: false });

    let data: unknown[];
    if (opts?.limit) {
      const from = opts.offset ?? 0;
      const to = from + opts.limit - 1; // Supabase .range() is inclusive
      const { data: page, error } = await baseQuery().range(from, to);
      if (error) throw error;
      data = page ?? [];
    } else {
      data = await fetchAllPages<UserRow>((from, to) => baseQuery().range(from, to));
    }

    return parseRows<UserRow>(data, USER_REQUIRED_KEYS, "users").map((row) => ({
      handle: row.handle,
      registeredAt: row.registered_at,
      displayName: row.display_name ?? null,
      avatarUrl: row.avatar_url ?? null,
    }));
  } catch (error) {
    console.error("[db] dbGetUsers failed:", (error as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Bulk email query
// ---------------------------------------------------------------------------

export interface UserWithEmail {
  handle: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Get all users who have an email AND have notifications enabled.
 * Used for campaign audience targeting.
 *
 * Pages through results with `fetchAllPages` instead of issuing a single
 * unpaginated select — PostgREST's `max_rows = 1000` cap (#1079) would
 * otherwise silently exclude any campaign audience past the first 1000
 * eligible users.
 *
 * Returns empty array when DB is unavailable.
 */
export async function dbGetUsersWithEmail(): Promise<UserWithEmail[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const data = await fetchAllPages<{
      handle: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
    }>((from, to) =>
      db
        .from("users")
        .select("handle, email, display_name, avatar_url")
        .not("email", "is", null)
        .eq("email_notifications", true)
        .order("registered_at", { ascending: false })
        .range(from, to),
    );

    return data.map((row) => ({
      handle: row.handle,
      email: row.email,
      displayName: row.display_name ?? null,
      avatarUrl: row.avatar_url ?? null,
    }));
  } catch (error) {
    console.error(
      "[db] dbGetUsersWithEmail failed:",
      (error as Error).message,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Email + notification preferences
// ---------------------------------------------------------------------------

interface UserEmailInfo {
  email: string;
  emailNotifications: boolean;
}

/**
 * Get a user's email and notification preference.
 * Returns null if user not found, has no email, or DB is unavailable.
 */
export async function dbGetUserEmail(
  handle: string,
): Promise<UserEmailInfo | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("users")
      .select("email, email_notifications")
      .eq("handle", handle.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.email) return null;

    return {
      email: data.email as string,
      emailNotifications: data.email_notifications as boolean,
    };
  } catch (error) {
    console.error("[db] dbGetUserEmail failed:", (error as Error).message);
    return null;
  }
}

/**
 * Update email notification preference for a user.
 * Used by the unsubscribe endpoint.
 */
export async function dbUpdateEmailNotifications(
  handle: string,
  enabled: boolean,
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const { error } = await db
      .from("users")
      .update({ email_notifications: enabled })
      .eq("handle", handle.toLowerCase());

    if (error) throw error;
  } catch (error) {
    console.error(
      "[db] dbUpdateEmailNotifications failed:",
      (error as Error).message,
    );
  }
}

