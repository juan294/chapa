/**
 * Admin authentication helpers.
 *
 * - `isAdminHandle` — role check against ADMIN_HANDLES env var.
 * - `verifyAdminSecret` — bearer-token check against ADMIN_SECRET env var.
 */

import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Verify that an incoming request carries a valid ADMIN_SECRET bearer token.
 *
 * Used by admin API endpoints that authenticate via a shared secret rather
 * than a user session (e.g. `/api/admin/stats`, `/api/admin/bulk-recalculate`).
 *
 * @returns `null` on success (caller should continue), or a ready-to-return
 *          `NextResponse` with 401 status on failure.
 *
 * When `ADMIN_SECRET` is not configured the function returns `null`
 * (pass-through) with a console warning — matching the `verifyCronSecret`
 * pattern for unconfigured environments.
 *
 * Usage:
 * ```ts
 * const denied = verifyAdminSecret(request);
 * if (denied) return denied;
 * // … authenticated admin logic
 * ```
 */
export function verifyAdminSecret(request: Request): NextResponse | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[admin] ADMIN_SECRET not configured — admin secret endpoints are unprotected",
    );
    return null;
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
  const raw = process.env.ADMIN_HANDLES?.trim();
  if (!raw) return false;

  const admins = raw.split(",").map((h) => h.trim().toLowerCase());
  return admins.includes(handle.toLowerCase());
}
