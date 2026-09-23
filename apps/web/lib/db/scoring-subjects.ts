import "server-only";
import { getSupabase } from "./supabase";

/**
 * Registers a scoring subject for a signed-up handle (`scoring_v7_ensure_subject`,
 * migration 054). Idempotent — a second call for an already-registered handle
 * is a no-op.
 *
 * Called only from the OAuth callback, after `dbUpsertUser` (#1335 phase 2):
 * the same authenticated-signup boundary that registers the `users` row
 * (#1239) is the only place allowed to create durable per-handle scoring
 * state. `/u/:handle` and `/u/:handle/badge.svg` accept any handle on earth,
 * so a render path must never call this — that was the exact mistake #1239
 * fixed for `users`, and a scoring subject row is the same kind of durable,
 * publicly-visible commitment.
 */
export async function dbEnsureScoringSubject(handle: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  try {
    const { error } = await db.rpc("scoring_v7_ensure_subject", { p_owner: handle.toLowerCase() });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbEnsureScoringSubject failed:", (error as Error).message);
    return false;
  }
}
