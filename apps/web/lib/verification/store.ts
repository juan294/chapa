import { cacheGet, cacheSet } from "@/lib/cache/redis";
import type { VerificationRecord } from "./types";

const VERIFY_TTL = 2_592_000; // 30 days in seconds

/**
 * Store a verification record in Redis.
 * Fail-open: silently no-ops if Redis is unavailable.
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
    // Fail open — verification is non-critical
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
