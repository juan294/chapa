import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetUsers } from "@/lib/db/users";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";

/** Vercel Pro allows up to 300s for serverless functions. */
export const maxDuration = 300;

/** Number of handles to process concurrently per batch. */
const BATCH_SIZE = 5;
/** Maximum handles processed inline per request. */
const MAX_INLINE_HANDLES = 100;
/** Abort inline work before the platform max duration is exhausted. */
const INLINE_DEADLINE_MS = 250_000;

/**
 * POST /api/admin/bulk-recalculate
 *
 * Force-recalculates impact scores for all (or specified) users using
 * the current scoring formulas. Uses `dbReplaceSnapshot` to overwrite
 * today's snapshot so users immediately see updated scores.
 *
 * Protected by ADMIN_SECRET bearer token (same as /api/admin/stats).
 *
 * Body (optional JSON):
 * - `handles?: string[]` — specific handles to recalculate. If omitted,
 *   recalculates all users from Supabase.
 */
export async function POST(request: NextRequest) {
  // Auth first: Bearer token must match ADMIN_SECRET.
  // Checking auth before rate limiting prevents unauthenticated callers from
  // exhausting the per-IP bucket and locking out legitimate admins (BE-H9).
  const denied = verifyAdminSecret(request);
  if (denied) return denied;

  // Rate limit: 5 requests per IP per hour (this is a heavy operation)
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-bulk-recalc:${ip}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Optional cursor: ?after=<handle> to resume a partial run (BE-H7).
  // Only handles that sort alphabetically after the cursor are processed,
  // allowing re-invocation to pick up where a previous 504 left off.
  const afterCursor = request.nextUrl.searchParams.get("after") ?? undefined;

  // Parse optional body for specific handles
  let handles: string[];
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.handles) && body.handles.length > 0) {
      handles = body.handles.filter(
        (h: unknown): h is string => typeof h === "string" && h.length > 0,
      );
    } else {
      const users = await dbGetUsers();
      handles = users.map((u) => u.handle);
    }
  } catch {
    const users = await dbGetUsers();
    handles = users.map((u) => u.handle);
  }

  // Apply cursor filter: skip handles up to and including the cursor value.
  if (afterCursor) {
    handles = handles.filter((h) => h > afterCursor);
  }

  if (handles.length === 0) {
    return NextResponse.json({
      partial: false,
      completed: [],
      recalculated: 0,
      failed: 0,
      total: 0,
      errors: [],
      ...(afterCursor ? { cursor: afterCursor } : {}),
    });
  }

  if (handles.length > MAX_INLINE_HANDLES) {
    return NextResponse.json(
      {
        error: `Payload too large. Max ${MAX_INLINE_HANDLES} handles per call.`,
      },
      { status: 413 },
    );
  }

  const githubToken = process.env.GITHUB_TOKEN?.trim() || undefined;
  const errors: { handle: string; error: string }[] = [];
  let recalculated = 0;
  const completed: string[] = [];
  const deadline = Date.now() + INLINE_DEADLINE_MS;

  for (let i = 0; i < handles.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) {
      return NextResponse.json(
        {
          partial: true,
          completed,
          pending: handles.slice(completed.length),
          recalculated,
          failed: errors.length,
          total: handles.length,
          errors: errors.length > 0 ? errors : undefined,
          ...(afterCursor ? { cursor: afterCursor } : {}),
        },
        { status: 202 },
      );
    }

    const batch = handles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (handle) => {
        try {
          const materialized = await materializeOrchestratedProfile(handle, {
            token: githubToken,
          });

          if (!materialized) {
            errors.push({ handle, error: "Stats fetch returned null" });
            return;
          }

          const replaced = await persistOrchestratedSnapshot(handle, materialized, {
            mode: "replace",
          });
          if (replaced) {
            recalculated++;
          } else {
            errors.push({ handle, error: "Snapshot replace failed" });
          }
        } catch (err) {
          errors.push({
            handle,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }),
    );
    completed.push(...batch);
  }

  return NextResponse.json({
    partial: false,
    completed,
    recalculated,
    failed: errors.length,
    total: handles.length,
    errors: errors.length > 0 ? errors : undefined,
    ...(afterCursor ? { cursor: afterCursor } : {}),
  });
}
