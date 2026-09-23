import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimitStrict } from "@/lib/cache/redis";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { readScoringStatus } from "@/lib/collection/read-scoring-status";
import { enqueueCollection, scheduleCollectionAdvance } from "@/lib/collection/enqueue";
import type { SourceProvider } from "@/lib/platform/source-authorization";

const VALID_PROVIDERS: readonly SourceProvider[] = ["github", "bitbucket", "gitlab", "codeberg"];
function isSourceProvider(value: unknown): value is SourceProvider {
  return typeof value === "string" && (VALID_PROVIDERS as readonly string[]).includes(value);
}

/**
 * GET /api/scoring/status
 *
 * Owner-only read of the authenticated handle's current `ScoringStatus`
 * (#1335 phase 4) -- ready, collecting (with per-provider progress), action
 * needed (with a reason and a recovery path), or unregistered. Backs the
 * share page's owner panel, `/settings`, and `/generating/:handle`'s poll.
 *
 * Rate limited like /api/refresh: fail-closed (rateLimitStrict), since this
 * is an authenticated route whose failure mode must not silently open up
 * under a Redis outage.
 */
export const GET = withErrorCapture("/api/scoring/status", async (request: NextRequest) => {
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login.toLowerCase();
  const rl = await rateLimitStrict(`ratelimit:scoring-status:${handle}`, 30, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const scoringStatus = await readScoringStatus(session.login);
  if (!scoringStatus) {
    // The authority read itself failed (a genuine DB error) -- never
    // reported as "unregistered" or any other real state. Every other
    // scored surface (badge, OG, share) treats this the same way.
    return NextResponse.json(
      { error: "Scoring status is temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ scoringStatus }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * POST /api/scoring/status
 *
 * Body: `{ action: "retry", provider }`. Enqueues a `retry`-reason
 * collection job for the given provider (resets an existing failed job for
 * it, per migration 055's enqueue semantics) and runs a bounded slice in the
 * background so the retry makes progress without the caller waiting a full
 * 5-minute collect-evidence cron tick.
 */
export const POST = withErrorCapture("/api/scoring/status", async (request: NextRequest) => {
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login.toLowerCase();
  const rl = await rateLimitStrict(`ratelimit:scoring-status-retry:${handle}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const body = await request.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "retry") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const provider = (body as { provider?: unknown }).provider;
  if (!isSourceProvider(provider)) {
    return NextResponse.json({ error: "A valid provider is required." }, { status: 400 });
  }

  await enqueueCollection(session.login, "retry", provider);
  scheduleCollectionAdvance();

  const scoringStatus = await readScoringStatus(session.login);
  if (!scoringStatus) {
    return NextResponse.json(
      { error: "Scoring status is temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ scoringStatus }, { headers: { "Cache-Control": "no-store" } });
});
