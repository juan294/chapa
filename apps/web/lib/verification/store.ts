import { dbStoreVerification, dbGetVerification } from "@/lib/db/verification";
import type { VerificationRecord } from "./types";

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
  try {
    return await dbGetVerification(hash);
  } catch {
    return null;
  }
}
