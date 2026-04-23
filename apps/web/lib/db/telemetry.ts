/**
 * Supabase data access — merge_operations table.
 *
 * Stores CLI merge telemetry data and provides retention cleanup.
 * Fail-open: returns false/0 on error, never throws.
 */

import { getSupabase } from "./supabase";

/** Rows older than this many days are eligible for cleanup. */
export const MERGE_OPS_RETENTION_DAYS = 90;

/** Max rows deleted per cleanup run to avoid locking the table. */
export const MERGE_OPS_CLEANUP_BATCH_SIZE = 1000;

export interface TelemetryPayload {
  operationId: string;
  targetHandle: string;
  sourceHandle: string;
  success: boolean;
  verified: boolean;
  errorCategory?: string;
  stats: {
    commitsTotal: number;
    reposContributed: number;
    prsMergedCount: number;
    activeDays: number;
    reviewsSubmittedCount: number;
  };
  timing: {
    fetchMs: number;
    uploadMs: number;
    totalMs: number;
  };
  cliVersion: string;
}

/**
 * Insert a merge operation telemetry record.
 * Maps camelCase payload to snake_case DB columns.
 * Returns true on success, false on error (fail-open).
 */
export async function dbInsertTelemetry(payload: TelemetryPayload): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db.from("merge_operations").insert({
      operation_id: payload.operationId,
      target_handle: payload.targetHandle.toLowerCase(),
      source_handle: payload.sourceHandle,
      success: payload.success,
      verified: payload.verified,
      error_category: payload.errorCategory ?? null,
      commits_total: payload.stats.commitsTotal,
      repos_contributed: payload.stats.reposContributed,
      prs_merged_count: payload.stats.prsMergedCount,
      active_days: payload.stats.activeDays,
      reviews_submitted_count: payload.stats.reviewsSubmittedCount,
      fetch_ms: payload.timing.fetchMs,
      upload_ms: payload.timing.uploadMs,
      total_ms: payload.timing.totalMs,
      cli_version: payload.cliVersion,
    });

    if (error) {
      console.error("[db] dbInsertTelemetry failed:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[db] dbInsertTelemetry failed:", (error as Error).message);
    return false;
  }
}

/**
 * Delete merge_operations rows older than MERGE_OPS_RETENTION_DAYS (90 days).
 * Batched to avoid table locks. Intended to be called from cron (warm-cache).
 * Returns the number of deleted rows, or 0 on error (fail-open).
 */
export async function dbCleanExpiredMergeOperations(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MERGE_OPS_RETENTION_DAYS);

    const { data, error } = await db
      .from("merge_operations")
      .delete()
      .lt("created_at", cutoff.toISOString())
      .limit(MERGE_OPS_CLEANUP_BATCH_SIZE)
      .select("id");

    if (error) throw error;
    return data?.length ?? 0;
  } catch (error) {
    console.error(
      "[db] dbCleanExpiredMergeOperations failed:",
      (error as Error).message,
    );
    return 0;
  }
}
