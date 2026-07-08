/**
 * Supabase Postgres client — lazy singleton for server-side data access.
 *
 * Uses the service role key (bypasses RLS) since all access is server-to-server.
 * Returns null when env vars are missing for graceful degradation.
 */

import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/async/with-timeout";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/lib/env";

let _client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    console.warn(
      "[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing — database disabled",
    );
    _client = null;
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * Lightweight health check — same pattern as pingRedis().
 * Returns "ok" if a representative query succeeds, "skipped" if env vars are
 * not configured, or "error" if the query fails.
 *
 * Probes `metrics_snapshots` (the app's hottest Supabase read — lifetime score
 * history) rather than `users`, mirroring the shape of the real hot-path read
 * in `dbGetLatestSnapshot` (select + order by date + limit). This validates the
 * service role's actual access to the table the app depends on most: a revoked
 * grant or misconfigured RLS policy scoped to `metrics_snapshots` would be
 * caught here, whereas a bare `users` connectivity check would miss it (#976).
 */
export async function pingSupabase(): Promise<"ok" | "error" | "skipped"> {
  const db = getSupabase();
  if (!db) return "skipped";

  try {
    const result = await withTimeout(
      Promise.resolve().then(() =>
        db
          .from("metrics_snapshots")
          .select("date")
          .order("date", { ascending: false })
          .limit(1),
      ),
      5000,
      "pingSupabase",
    );
    return result.error ? "error" : "ok";
  } catch {
    return "error";
  }
}

/** Reset the singleton — for tests only. */
export function _resetClient(): void {
  _client = undefined;
}
