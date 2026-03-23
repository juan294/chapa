import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Verify that an incoming request carries a valid CRON_SECRET bearer token.
 *
 * Vercel sends `CRON_SECRET` as `Authorization: Bearer <secret>` on cron
 * invocations. This helper centralises that check for all cron routes.
 *
 * @returns `null` on success (caller should continue), or a ready-to-return
 *          `NextResponse` with 401 status on failure.
 *
 * Usage:
 * ```ts
 * const denied = verifyCronSecret(request);
 * if (denied) return denied;
 * // … authenticated cron logic
 * ```
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
