import { timingSafeEqual } from "node:crypto";
import { dbStoreVerification } from "@/lib/db/verification";
import { parseRow } from "@/lib/db/parse-row";
import { getSupabase } from "@/lib/db/supabase";
import type { VerificationRecord } from "./types";

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

const VERIFICATION_REQUIRED_KEYS: readonly (keyof VerificationRow & string)[] = [
  "hash",
  "handle",
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
] as const;

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
      delivery: row.building,
      quality: row.guarding,
      consistency: row.consistency,
      breadth: row.breadth,
    },
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    reviewsSubmittedCount: row.reviews_submitted,
    generatedAt: row.generated_at,
  };
}

/**
 * Store a verification record in Supabase.
 * Fail-open: silently no-ops if the store is unavailable.
 */
export async function storeVerificationRecord(
  hash: string,
  record: VerificationRecord,
): Promise<void> {
  try {
    await dbStoreVerification(hash, record);
  } catch {
    // Fail open — verification storage is non-critical
  }
}

/**
 * Retrieve a verification record by hash.
 * Reads from Supabase.
 * Returns null on miss or if DB is unavailable.
 */
export async function getVerificationRecord(
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

    const row = parseRow<VerificationRow>(
      data,
      VERIFICATION_REQUIRED_KEYS,
      "verification_records",
    );
    if (!row) return null;

    const requestedHash = Buffer.from(hash, "hex");
    const storedHash = Buffer.from(row.hash, "hex");
    if (requestedHash.length !== storedHash.length) return null;
    if (!timingSafeEqual(requestedHash, storedHash)) return null;

    return rowToRecord(row);
  } catch {
    return null;
  }
}
