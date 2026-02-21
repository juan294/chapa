/**
 * Supabase data access — merge_operations table.
 *
 * Stores CLI merge telemetry data. Fail-open: returns false on error, never throws.
 */

import { getSupabase } from "./supabase";

export interface TelemetryPayload {
  operationId: string;
  targetHandle: string;
  sourceHandle: string;
  success: boolean;
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
