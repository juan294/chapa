/**
 * Supabase data access — verification_records table.
 *
 * Replaces Redis `verify:<hash>` + `verify-handle:<handle>` keys.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import type { VerificationRecord } from "@/lib/verification/types";
import { getSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Row ↔ Type mapping
// ---------------------------------------------------------------------------

interface VerificationRow {
  hash: string;
  handle: string;
  display_name: string | null;
  adjusted_composite: number;
  confidence: number;
  tier: string;
  archetype: string;
  profile_type: string;
  building: number;
  guarding: number;
  consistency: number;
  breadth: number;
  commits_total: number;
  prs_merged_count: number;
  reviews_submitted: number;
  generated_at: string;
}

function rowToRecord(row: VerificationRow): VerificationRecord {
  return {
    handle: row.handle,
    ...(row.display_name != null && { displayName: row.display_name }),
    adjustedComposite: row.adjusted_composite,
    confidence: row.confidence,
    tier: row.tier,
    archetype: row.archetype,
    profileType: row.profile_type,
    dimensions: {
      building: row.building,
      guarding: row.guarding,
      consistency: row.consistency,
      breadth: row.breadth,
    },
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    reviewsSubmittedCount: row.reviews_submitted,
    generatedAt: row.generated_at,
  };
}

const RECORD_COLUMNS = [
  "hash",
  "handle",
  "display_name",
  "adjusted_composite",
  "confidence",
  "tier",
  "archetype",
  "profile_type",
  "building",
  "guarding",
  "consistency",
  "breadth",
  "commits_total",
  "prs_merged_count",
  "reviews_submitted",
  "generated_at",
].join(", ");

// ---------------------------------------------------------------------------
// Public API — matches existing store.ts signatures
// ---------------------------------------------------------------------------

/**
 * Store a verification record. Upserts on hash conflict (latest wins).
 */
export async function dbStoreVerification(
  hash: string,
  record: VerificationRecord,
): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  try {
    const { error } = await db.from("verification_records").upsert(
      {
        hash,
        handle: record.handle.toLowerCase(),
        display_name: record.displayName ?? null,
        adjusted_composite: record.adjustedComposite,
        confidence: record.confidence,
        tier: record.tier,
        archetype: record.archetype,
        profile_type: record.profileType,
        building: record.dimensions.building,
        guarding: record.dimensions.guarding,
        consistency: record.dimensions.consistency,
        breadth: record.dimensions.breadth,
        commits_total: record.commitsTotal,
        prs_merged_count: record.prsMergedCount,
        reviews_submitted: record.reviewsSubmittedCount,
        generated_at: record.generatedAt,
        // expires_at uses DB default: now() + 30 days
      },
      { onConflict: "hash" },
    );

    if (error) throw error;
  } catch (error) {
    console.error(
      "[db] dbStoreVerification failed:",
      (error as Error).message,
    );
  }
}

/**
 * Retrieve a verification record by hash.
 * Returns null on miss, expired record, or error.
 */
export async function dbGetVerification(
  hash: string,
): Promise<VerificationRecord | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("verification_records")
      .select(RECORD_COLUMNS)
      .eq("hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return rowToRecord(data as unknown as VerificationRow);
  } catch (error) {
    console.error(
      "[db] dbGetVerification failed:",
      (error as Error).message,
    );
    return null;
  }
}

/**
 * Delete expired verification records.
 * Intended to be called from cron (warm-cache).
 * Returns the number of deleted rows, or 0 on error.
 */
export async function dbCleanExpiredVerifications(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  try {
    const { data, error } = await db
      .from("verification_records")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw error;
    return data?.length ?? 0;
  } catch (error) {
    console.error(
      "[db] dbCleanExpiredVerifications failed:",
      (error as Error).message,
    );
    return 0;
  }
}
