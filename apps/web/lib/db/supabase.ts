/**
 * Supabase Postgres client — lazy singleton for server-side data access.
 *
 * Uses the service role key (bypasses RLS) since all access is server-to-server.
 * Returns null when env vars are missing for graceful degradation.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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

/** Reset the singleton — for tests only. */
export function _resetClient(): void {
  _client = undefined;
}
