import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetUsers } from "@/lib/db/users";
import { processInBatches } from "@/lib/async/process-in-batches";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";

/** Vercel Pro allows up to 300s for serverless functions. */
export const maxDuration = 300;

/** Number of handles to process concurrently per batch. */
const BATCH_SIZE = 5;

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
  // Rate limit: 5 requests per IP per hour (this is a heavy operation)
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-bulk-recalc:${ip}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Auth: Bearer token must match ADMIN_SECRET
  const denied = verifyAdminSecret(request);
  if (denied) return denied;

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

  if (handles.length === 0) {
    return NextResponse.json({ recalculated: 0, failed: 0, total: 0, errors: [] });
  }

  const githubToken = process.env.GITHUB_TOKEN?.trim() || undefined;
  const errors: { handle: string; error: string }[] = [];
  let recalculated = 0;

  await processInBatches(handles, BATCH_SIZE, async (handle) => {
    try {
      const materialized = await materializeOrchestratedProfile(handle, {
        token: githubToken,
        craftMode: "cached",
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
  });

  return NextResponse.json({
    recalculated,
    failed: errors.length,
    total: handles.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
