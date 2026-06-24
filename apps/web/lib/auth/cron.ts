import "server-only";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { getCronSecret } from "@/lib/env";

/**
 * Verify that an incoming request carries a valid CRON_SECRET bearer token.
 *
 * Vercel sends `CRON_SECRET` as `Authorization: Bearer <secret>` on cron
 * invocations. This helper centralises that check for all cron routes.
 *
 * @returns `null` on success (caller should continue), or a ready-to-return
 *          `NextResponse` with an error status on failure.
 *
 * When `CRON_SECRET` is not configured the function returns a 503 response
 * (fail-secure) — endpoints must not be publicly accessible due to a missing
 * environment variable.
 *
 * Usage:
 * ```ts
 * const denied = verifyCronSecret(request);
 * if (denied) return denied;
 * // … authenticated cron logic
 * ```
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  const secret = getCronSecret();
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET not configured — rejecting request (fail-secure)",
    );
    return NextResponse.json(
      { error: "Cron secret not configured" },
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
