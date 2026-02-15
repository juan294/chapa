import { NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { getSnapshots } from "@/lib/history/history";
import { compareSnapshots } from "@/lib/history/diff";
import { computeTrend } from "@/lib/history/trend";

type Params = { params: Promise<{ handle: string }> };

const VALID_INCLUDES = new Set(["snapshots", "trend", "diff"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, context: Params) {
  const { handle } = await context.params;

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
  const windowParam = url.searchParams.get("window");
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

  const window = windowParam ? parseInt(windowParam, 10) : undefined;

  // Fetch snapshots
  const snapshots = await getSnapshots(handle, from, to);

  // Build response
  const response: Record<string, unknown> = { handle };

  if (includes.has("snapshots")) {
    response.snapshots = snapshots;
  }

  if (includes.has("trend")) {
    response.trend = snapshots.length >= 2 ? computeTrend(snapshots, window) : null;
  }

  if (includes.has("diff")) {
    if (snapshots.length >= 2) {
      const prev = snapshots[snapshots.length - 2]!;
      const curr = snapshots[snapshots.length - 1]!;
      response.diff = compareSnapshots(prev, curr);
    } else {
      response.diff = null;
    }
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
