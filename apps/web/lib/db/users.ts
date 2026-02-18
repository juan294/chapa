/**
 * Supabase data access — users table.
 *
 * Replaces Redis `user:registered:<handle>` keys.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRows } from "./parse-row";

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface UserRow {
  handle: string;
  registered_at: string;
}

const USER_REQUIRED_KEYS: readonly (keyof UserRow)[] = [
  "handle",
  "registered_at",
] as const;

/**
 * Register a user (upsert — idempotent).
 * Handles are stored lowercase for consistent lookups.
 *
 * When `email` is provided, updates the email even for existing users
 * (ignoreDuplicates: false). Without email, existing rows are left untouched.
 */
export async function dbUpsertUser(
  handle: string,
  email?: string,
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const row: Record<string, string> = { handle: handle.toLowerCase() };
    if (email) row.email = email;

    await db
      .from("users")
      .upsert(row, {
        onConflict: "handle",
        // When we have new data (email), update the existing row.
        // Without email, skip duplicates to preserve existing data.
        ignoreDuplicates: !email,
      });
  } catch (error) {
    console.error("[db] dbUpsertUser failed:", (error as Error).message);
  }
}

/**
 * Get registered users, ordered by registration date (newest first).
 * Supports optional pagination via limit/offset.
 * Returns empty array when DB is unavailable.
 */
export async function dbGetUsers(
  opts?: { limit?: number; offset?: number },
): Promise<{ handle: string; registeredAt: string }[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    let query = db
      .from("users")
      .select("handle, registered_at")
      .order("registered_at", { ascending: false });

    if (opts?.limit) {
      const from = opts.offset ?? 0;
      const to = from + opts.limit - 1; // Supabase .range() is inclusive
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) throw error;

    return parseRows<UserRow>(data, USER_REQUIRED_KEYS, "users").map((row) => ({
      handle: row.handle,
      registeredAt: row.registered_at,
    }));
  } catch (error) {
    console.error("[db] dbGetUsers failed:", (error as Error).message);
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

