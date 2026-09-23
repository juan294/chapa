import { readObservedScoringHistory } from "@/lib/history/observed-history";
import { NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

type Params = { params: Promise<{ handle: string }> };

const VALID_INCLUDES = new Set(["snapshots", "trend", "diff"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EMPTY_HISTORY = { observations: [], trend: [], comparisons: [] };

/**
 * Public (unauthenticated) history endpoint.
 *
 * This is intentionally public — it follows the same pattern as the badge
 * endpoint (`/u/:handle/badge.svg`). Both serve publicly-visible metric
 * data derived from a user's GitHub activity. Requiring auth here would
 * break embeddable use-cases and third-party integrations that consume
 * historical trend data. Rate limiting (100 req/IP/60s) provides abuse
 * protection instead of authentication.
 *
 * #1335 phase 5 — observed (v7.2) history only. `metrics_snapshots` and its
 * smoothed trend/diff computation are retired; `include=snapshots,trend,diff`
 * now names the current v7.2 observations, trend anchors, and latest
 * comparison respectively.
 */
export const GET = withErrorCapture("/api/history/[handle]", async (request: NextRequest, ctx) => {
  const { handle } = await (ctx as Params).params;

  if (!isValidHandle(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  // Rate limit: 100 req/IP/60s
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:history:${ip}`, 100, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Parse query params
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const includeParam = url.searchParams.get("include") ?? "snapshots,trend";

  // Validate date params
  if (from && !DATE_RE.test(from)) {
    return NextResponse.json({ error: "Invalid 'from' date format (YYYY-MM-DD)" }, { status: 400 });
  }
  if (to && !DATE_RE.test(to)) {
    return NextResponse.json({ error: "Invalid 'to' date format (YYYY-MM-DD)" }, { status: 400 });
  }

  const includes = new Set(
    includeParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID_INCLUDES.has(s)),
  );

  const stored = await readObservedScoringHistory(handle, { from, to });
  if (stored.status === "unavailable") {
    return NextResponse.json({ error: "Current scoring history is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const history = stored.status === "found" ? stored.history : EMPTY_HISTORY;

  return NextResponse.json({
    handle,
    policyVersion: "v7.2",
    ...(includes.has("snapshots") && { snapshots: history.observations }),
    ...(includes.has("trend") && { trend: history.trend }),
    ...(includes.has("diff") && { diff: history.comparisons.at(-1) ?? null }),
  }, { headers: { "Cache-Control": "no-store" } });
});
