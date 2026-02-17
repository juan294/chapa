/**
 * Supabase data access — users table.
 *
 * Replaces Redis `user:registered:<handle>` keys.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";

/**
 * Register a user (upsert — idempotent).
 * Handles are stored lowercase for consistent lookups.
 */
export async function dbUpsertUser(handle: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    await db
      .from("users")
      .upsert(
        { handle: handle.toLowerCase() },
        { onConflict: "handle", ignoreDuplicates: true },
      );
  } catch (error) {
    console.error("[db] dbUpsertUser failed:", (error as Error).message);
  }
}

/**
 * Get all registered users, ordered by registration date (newest first).
 * Returns empty array when DB is unavailable.
 */
export async function dbGetUsers(): Promise<
  { handle: string; registeredAt: string }[]
> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("users")
      .select("handle, registered_at")
      .order("registered_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      handle: row.handle,
      registeredAt: row.registered_at,
    }));
  } catch (error) {
    console.error("[db] dbGetUsers failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get total registered user count.
 * Returns 0 when DB is unavailable.
 */
export async function dbGetUserCount(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  try {
    const { count, error } = await db
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("[db] dbGetUserCount failed:", (error as Error).message);
    return 0;
  }
}
