import { NextResponse } from "next/server";

/**
 * Centralized ownership-check helper (BE-S1 #896).
 *
 * Verifies that the authenticated identity owns the target handle.
 * This is the single audited ownership gate used by every write route
 * that accepts a per-handle target (supplemental, insights, recalculate,
 * refresh, generate, studio/config).
 *
 * Usage:
 *   const ownershipError = assertHandleOwnership(auth, targetHandle);
 *   if (ownershipError) return ownershipError;
 *
 * @param auth   Resolved auth object from resolveRequestAuth (or requireSession),
 *               or null/undefined when the caller is unauthenticated.
 * @param targetHandle  The handle the caller claims to be acting on.
 * @returns null if ownership is confirmed; a NextResponse (401 or 403) otherwise.
 *          Never throws.
 */
export function assertHandleOwnership(
  auth: { handle: string } | null | undefined,
  targetHandle: string,
): Response | null {
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (auth.handle.toLowerCase() !== targetHandle.toLowerCase()) {
    return NextResponse.json(
      { error: "You do not have permission to act on this handle" },
      { status: 403 },
    );
  }

  return null;
}
