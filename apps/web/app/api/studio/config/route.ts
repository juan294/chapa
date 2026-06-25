import { type NextRequest, NextResponse } from "next/server";
import {
  getOptionalRequestSession,
  getSessionSecret,
  requireRequestSession,
} from "@/lib/auth/session";
import { cacheGet, cacheSet, rateLimit } from "@/lib/cache/redis";
import { isValidBadgeConfig } from "@/lib/validation";
import { isStudioEnabled } from "@/lib/feature-flags";
import { dbGetStudioConfig, dbUpsertStudioConfig } from "@/lib/db/studio";
import type { BadgeConfig } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const CONFIG_TTL = 31536000; // 365 days

/**
 * GET /api/studio/config — Load the authenticated user's badge config.
 * Returns { config: BadgeConfig | null }.
 * Read path: Redis first; on miss, fall back to Supabase and rehydrate Redis.
 */
export const GET = withErrorCapture("/api/studio/config", async (request: NextRequest) => {
  if (!(await isStudioEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!getSessionSecret()) {
    return NextResponse.json({ config: null });
  }

  const session = getOptionalRequestSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const cacheKey = `config:${session.login}`;

  const cached = await cacheGet<BadgeConfig>(cacheKey);
  if (cached !== null) {
    return NextResponse.json({ config: cached });
  }

  // Redis miss — fall back to Supabase and rehydrate Redis (best-effort)
  const dbConfig = await dbGetStudioConfig(session.login);
  if (dbConfig !== null) {
    cacheSet(cacheKey, dbConfig as BadgeConfig, CONFIG_TTL).catch((err: unknown) => {
      console.warn("[studio/config] Redis rehydration failed (best-effort):", (err as Error).message);
    });
    return NextResponse.json({ config: dbConfig });
  }

  return NextResponse.json({ config: null });
});

/**
 * PUT /api/studio/config — Save the authenticated user's badge config.
 * Auth required. Rate limited: 30 requests/hour per user.
 * Write path: Supabase is the success criterion; Redis is best-effort.
 */
export const PUT = withErrorCapture("/api/studio/config", async (request: NextRequest) => {
  if (!(await isStudioEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { session, error } = requireRequestSession(request);
  if (error) return error;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate config shape
  if (!isValidBadgeConfig(body)) {
    return NextResponse.json({ error: "Invalid badge config" }, { status: 400 });
  }

  // Rate limit: 30 saves per hour per user
  const rl = await rateLimit(`ratelimit:config:${session.login}`, 30, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many saves. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const cacheKey = `config:${session.login}`;

  // Write to Supabase (durable) AND Redis (hot read path).
  // Supabase is the success criterion — Redis is best-effort.
  const [, dbOk] = await Promise.all([
    cacheSet(cacheKey, body as BadgeConfig, CONFIG_TTL).catch((err: unknown) => {
      console.warn("[studio/config] Redis write failed (best-effort):", (err as Error).message);
    }),
    dbUpsertStudioConfig(session.login, body),
  ]);

  if (!dbOk) {
    return NextResponse.json(
      { success: false, error: "Failed to persist studio config" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
});
