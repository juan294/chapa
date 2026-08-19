import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminSecret } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetUserHandlePage } from "@/lib/db/users";
import { isValidHandle } from "@/lib/validation";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";

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
 *   recalculates all users from Supabase in bounded pages. A 202 response
 *   includes `nextCursor`; pass it as `?after=` to continue.
 */
export const POST = withErrorCapture("/api/admin/bulk-recalculate", async (request: NextRequest) => {
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

  // Optional cursor: ?after=<handle> continues an all-user page or resumes a
  // time-limited run (BE-H7). The database applies this unique keyset cursor
  // before returning at most MAX_INLINE_HANDLES + 1 handles.
  const afterCursor = request.nextUrl.searchParams.get("after") ?? undefined;

  // Parse optional body for specific handles.
  const body = await request.json().catch(() => ({}));
  let handles: string[];
  const explicitHandles = Array.isArray(body.handles) && body.handles.length > 0;
  let totalAvailable: number;

  if (explicitHandles) {
    handles = (body.handles as unknown[])
      .filter((h): h is string => typeof h === "string")
      .map((h) => h.trim())
      .filter((h) => isValidHandle(h));
    handles = [...new Set(handles)].sort((a, b) => a.localeCompare(b));
    if (afterCursor) {
      handles = handles.filter((h) => h.localeCompare(afterCursor) > 0);
    }
    totalAvailable = handles.length;
  } else {
    const page = await dbGetUserHandlePage({
      ...(afterCursor ? { after: afterCursor } : {}),
      limit: MAX_INLINE_HANDLES + 1,
    });
    handles = page.handles;
    totalAvailable = page.total;
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

  if (explicitHandles && handles.length > MAX_INLINE_HANDLES) {
    return NextResponse.json(
      {
        error: `Payload too large. Max ${MAX_INLINE_HANDLES} handles per call.`,
      },
      { status: 413 },
    );
  }

  const hasMore = !explicitHandles && totalAvailable > MAX_INLINE_HANDLES;
  if (hasMore) handles = handles.slice(0, MAX_INLINE_HANDLES);
  const nextCursor = hasMore ? handles.at(-1) : undefined;
  const remaining = totalAvailable - handles.length;

  const errors: { handle: string; error: string }[] = [];
  let recalculated = 0;
  const completed: string[] = [];
  const deadline = Date.now() + INLINE_DEADLINE_MS;

  for (let i = 0; i < handles.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) {
      // BE-M3 (#952): Use a Set to compute pending instead of slice(completed.length).
      // slice assumes `completed` is always a dense prefix of `handles`, which breaks
      // silently if batch ordering ever diverges from handles order. A Set-based filter
      // is correct regardless of insertion order.
      const completedSet = new Set(completed);
      return NextResponse.json(
        {
          partial: true,
          completed,
          pending: handles.filter((h) => !completedSet.has(h)),
          recalculated,
          failed: errors.length,
          total: totalAvailable,
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
            // #930 — Admin recalculates must bypass the EMA same-day lock.
            // A stored today-snapshot may contain wrong data (e.g. from a
            // timed-out platform fetch); ignoring it ensures the fresh score
            // always lands rather than freezing the bad value in place.
            ignoreSnapshot: true,
          });

          if (!materialized) {
            errors.push({ handle, error: "Stats fetch returned null" });
            return;
          }

          const replaced = await persistOrchestratedSnapshot(handle, materialized, {
            mode: "replace",
          });
          if (replaced) {
            await invalidateProfileReadModels(handle, {
              stats: true,
              badgeSvg: true,
              snapshot: true,
              history: true,
            });
            revalidatePath(`/u/${handle}`);
            recalculated++;
            completed.push(handle);
          } else {
            // #1076 — persistOrchestratedSnapshot's #1003 gate intentionally
            // skips persistence when the fetched stats look incomplete/
            // poisoned. Distinguish that from a genuine write failure so an
            // operator scanning this batch's errors can tell them apart.
            errors.push({
              handle,
              error: materialized.statsComplete
                ? "Snapshot replace failed"
                : "Snapshot skipped: stats incomplete",
            });
          }
        } catch (err) {
          errors.push({
            handle,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }),
    );
  }

  return NextResponse.json(
    {
      partial: hasMore,
      completed,
      recalculated,
      failed: errors.length,
      total: totalAvailable,
      errors: errors.length > 0 ? errors : undefined,
      ...(afterCursor ? { cursor: afterCursor } : {}),
      ...(hasMore ? { remaining, nextCursor } : {}),
    },
    { status: hasMore ? 202 : 200 },
  );
});
