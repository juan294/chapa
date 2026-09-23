/**
 * Supabase data access — v7.2 receipt verification RPC bridge.
 *
 * The v6 `verification_records` table and its CRUD (dbStoreVerification,
 * dbGetVerification, dbCleanExpiredVerifications) were retired in #1335
 * phase 5: legacy verification codes are no longer issued or looked up here.
 * `/verify/<retired hex>` and `/api/verify/<retired hex>` now answer with a
 * static 410 `retired_v6_code` instead of a database read.
 */

import { getSupabase } from "./supabase";

/** V7 operations fail closed; never expose database errors or receipt inputs. */
export async function dbVerificationRpcV7(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getSupabase();
  if (!db) throw new Error("Receipt verification storage unavailable");
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error("Receipt verification storage unavailable");
  return data;
}
