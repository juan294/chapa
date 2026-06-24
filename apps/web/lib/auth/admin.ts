/**
 * Admin authentication helpers.
 *
 * - `isAdminHandle` — role check against ADMIN_HANDLES env var.
 * - `verifyAdminSecret` — bearer-token check against ADMIN_SECRET env var.
 */

import "server-only";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { getAdminSecret, getAdminHandles } from "@/lib/env";

/**
 * Verify that an incoming request carries a valid ADMIN_SECRET bearer token.
 *
 * Used by admin API endpoints that authenticate via a shared secret rather
 * than a user session (e.g. `/api/admin/stats`, `/api/admin/bulk-recalculate`).
 *
 * @returns `null` on success (caller should continue), or a ready-to-return
 *          `NextResponse` with an error status on failure.
 *
 * When `ADMIN_SECRET` is not configured the function returns a 503 response
 * (fail-secure) — endpoints must not be publicly accessible due to a missing
 * environment variable.
 *
 * Usage:
 * ```ts
 * const denied = verifyAdminSecret(request);
 * if (denied) return denied;
 * // … authenticated admin logic
 * ```
 */
export function verifyAdminSecret(request: Request): NextResponse | null {
  const secret = getAdminSecret();
  if (!secret) {
    console.error(
      "[admin] ADMIN_SECRET not configured — rejecting request (fail-secure)",
    );
    return NextResponse.json(
      { error: "Admin secret not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * Admin role identification.
 *
 * Uses `ADMIN_HANDLES` env var (comma-separated GitHub handles, server-side only).
 * Comparison is case-insensitive since GitHub handles are case-insensitive.
 */
export function isAdminHandle(handle: string): boolean {
  if (!handle) return false;
  const admins = getAdminHandles().map((h) => h.toLowerCase());
  if (!admins.length) return false;
  return admins.includes(handle.toLowerCase());
}
