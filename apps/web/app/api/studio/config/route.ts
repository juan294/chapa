import { type NextRequest, NextResponse } from "next/server";
import { invalidateBadgeSvgCacheForHandle } from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import {
  getOptionalRequestSession,
  getSessionSecret,
  requireRequestSession,
} from "@/lib/auth/session";
import { rateLimit } from "@/lib/cache/redis";
import { isValidBadgeConfig } from "@/lib/validation";
import { isStudioEnabled } from "@/lib/feature-flags";
import { dbUpsertStudioConfig, loadStudioConfig } from "@/lib/db/studio";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const studioConfigWriteTails = new Map<string, Promise<void>>();

async function serializeStudioConfigWrite<T>(
  login: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = login.toLowerCase();
  const previous = studioConfigWriteTails.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tail = current.then(
    () => undefined,
    () => undefined,
  );
  studioConfigWriteTails.set(key, tail);

  try {
    return await current;
  } finally {
    if (studioConfigWriteTails.get(key) === tail) {
      studioConfigWriteTails.delete(key);
    }
  }
}

/**
 * GET /api/studio/config — Load the authenticated user's badge config.
 * Returns { config: BadgeConfig | null }.
 * Read path: Supabase directly — no Redis involvement (#1186/BE-L1).
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

  const config = await loadStudioConfig(session.login);
  if (config.status === "found") {
    return NextResponse.json({ config: config.config });
  }
  if (config.status === "not_found") {
    return NextResponse.json({ config: null });
  }
  if (config.status === "unavailable") {
    return NextResponse.json(
      { error: "Storage temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
  return NextResponse.json(
    { error: "Invalid persisted studio config" },
    { status: 500 },
  );
});

/**
 * PUT /api/studio/config — Save the authenticated user's badge config.
 * Auth required. Rate limited: 30 requests/hour per user.
 * Write path: Supabase only — no Redis mirror (removed, nothing read it back
 * once the read path stopped consulting Redis; see `apps/web/lib/db/studio.ts`).
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

  const normalizedLogin = session.login.toLowerCase();
  const dbResult = await serializeStudioConfigWrite(normalizedLogin, () =>
    dbUpsertStudioConfig(normalizedLogin, body),
  );

  if (!dbResult.ok && dbResult.reason === "constraint") {
    return NextResponse.json(
      { success: false, error: "Invalid badge config" },
      { status: 400 },
    );
  }

  if (!dbResult.ok && dbResult.reason === "unavailable") {
    return NextResponse.json(
      { success: false, error: "Storage temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }

  if (!dbResult.ok) {
    return NextResponse.json(
      { success: false, error: "Failed to persist studio config" },
      { status: 500 },
    );
  }

  // #1191 — the badge cache key carries handle/variant/date/locale but nothing
  // about the config, so a save has to say explicitly that the rendered badge
  // is now wrong. Fire-and-forget: a failed invalidation leaves a stale badge
  // until the day rolls over, which is the same self-healing risk the platform
  // link/unlink path already accepts, and is not worth failing a save over.
  fireAndForget(() =>
    invalidateBadgeSvgCacheForHandle(normalizedLogin, toDateString(new Date())),
  );

  return NextResponse.json({ success: true });
});
