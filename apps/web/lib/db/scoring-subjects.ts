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

/**
 * Whether a handle is a registered scoring subject -- the sharp test every
 * scored surface uses to distinguish "not on Chapa yet" from "signed up, no
 * receipt yet" (#1335 phase 4, decision 5). Three states, not two: a genuine
 * DB read failure ("unavailable") must never be reported as "unregistered" --
 * `lib/collection/read-scoring-status.ts` maps it to an authority-read
 * failure (a `null` `ScoringStatus`), never to the unregistered state.
 */
export async function dbIsScoringSubject(handle: string): Promise<"registered" | "unregistered" | "unavailable"> {
  const db = getSupabase();
  if (!db) return "unavailable";
  try {
    const { data, error } = await db
      .from("scoring_v7_subjects")
      .select("owner_handle")
      .eq("owner_handle", handle.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data ? "registered" : "unregistered";
  } catch (error) {
    console.error("[db] dbIsScoringSubject failed:", (error as Error).message);
    return "unavailable";
  }
}
