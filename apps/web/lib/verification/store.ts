import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { dbStoreVerification } from "@/lib/db/verification";
import type { VerificationRecord } from "./types";

const VERIFY_TTL = 2_592_000; // 30 days in seconds

/**
 * Store a verification record in Redis + Supabase (dual-write).
 * Fail-open: silently no-ops if either store is unavailable.
 */
export async function storeVerificationRecord(
  hash: string,
  record: VerificationRecord,
): Promise<void> {
  try {
    await Promise.all([
      cacheSet(`verify:${hash}`, record, VERIFY_TTL),
      cacheSet(`verify-handle:${record.handle.toLowerCase()}`, hash, VERIFY_TTL),
    ]);
  } catch {
    // Fail open — Redis verification is non-critical
  }

  // Dual-write to Supabase (fire-and-forget, independent of Redis)
  try {
    void dbStoreVerification(hash, record);
  } catch {
    // Supabase errors are non-critical
  }
}

/**
 * Retrieve a verification record by hash.
 * Returns null on miss or if Redis is unavailable.
 */
export async function getVerificationRecord(
  hash: string,
): Promise<VerificationRecord | null> {
  try {
    return await cacheGet<VerificationRecord>(`verify:${hash}`);
  } catch {
    return null;
  }
}
