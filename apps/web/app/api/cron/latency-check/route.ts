import { type NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { getBaseUrl, getWarmCachePriorityHandles } from "@/lib/env";
import {
  captureOperationalAlert,
  withErrorCapture,
} from "@/lib/analytics/server-errors";
import {
  BADGE_LATENCY_SLO_MS,
  evaluateBadgeLatency,
  serverTimingIndicatesCacheHit,
} from "@/lib/monitoring/latency-slo";
import { cacheSet } from "@/lib/cache/redis";

/** Synthetic probe should never run long — the SLO ceiling is 3s. */
export const maxDuration = 60;

/** Handle probed when no priority handles are configured. */
const DEFAULT_PROBE_HANDLE = "octocat";

/** Abort the probe well beyond the cache-miss SLO so a hang still reports. */
const PROBE_TIMEOUT_MS = 10_000;

const HEARTBEAT_KEY = "cron:lastrun:latency-check";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

/**
 * GET /api/cron/latency-check
 *
 * Synthetic latency monitor for the badge SVG route (#974). Times a real
 * request to `/u/:handle/badge.svg` through the public URL (CDN + origin),
 * classifies it as a cache-hit or cache-miss from the response's Server-Timing
 * header, and evaluates the measured duration against the p95 SLO budgets in
 * `lib/monitoring/latency-slo.ts`. On a breach — or a failed probe — it raises
 * a P2 operational alert via CHAPA_ALERT_WEBHOOK_URL (the existing P1/P2 alert
 * mechanism used by the health check).
 *
 * The probe uses the read-only smoke param so it never triggers snapshot
 * persistence or cache writes.
 *
 * Protected by CRON_SECRET — Vercel sends this automatically as a Bearer token.
 */
export const GET = withErrorCapture(
  "/api/cron/latency-check",
  async (request: NextRequest) => {
    const denied = verifyCronSecret(request);
    if (denied) return denied;

    const handle = getWarmCachePriorityHandles()[0] ?? DEFAULT_PROBE_HANDLE;
    const probeUrl = `${getBaseUrl()}/u/${handle}/badge.svg?__chapa_smoke=1`;

    let ok = false;
    let httpStatus = 0;
    let cacheHit = false;
    const startedAt = Date.now();
    try {
      const response = await fetch(probeUrl, {
        headers: { "User-Agent": "chapa-latency-check" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: "no-store",
      });
      httpStatus = response.status;
      ok = response.ok;
      cacheHit = serverTimingIndicatesCacheHit(
        response.headers.get("Server-Timing") ?? "",
      );
      // Drain the body so the measured duration includes the full transfer.
      await response.arrayBuffer();
    } catch {
      ok = false;
    }
    const durationMs = Date.now() - startedAt;

    const evaluation = evaluateBadgeLatency({ durationMs, cacheHit });
    const breached = ok && evaluation.breached;

    if (!ok || breached) {
      await captureOperationalAlert({
        signal: "badge_latency_slo_breach",
        severity: "P2",
        summary: ok
          ? `Badge route latency ${durationMs}ms exceeded the ${
              cacheHit ? "cache-hit" : "cache-miss"
            } p95 budget of ${evaluation.budgetMs}ms`
          : `Badge route latency probe failed (HTTP ${httpStatus || "no response"})`,
        route: "/api/cron/latency-check",
        properties: {
          handle,
          durationMs,
          budgetMs: evaluation.budgetMs,
          cacheHit,
          httpStatus,
          ok,
          slo: BADGE_LATENCY_SLO_MS,
        },
      });
    }

    await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

    return NextResponse.json({
      status: !ok ? "error" : breached ? "breached" : "ok",
      handle,
      durationMs,
      budgetMs: evaluation.budgetMs,
      cacheHit,
      httpStatus,
      slo: BADGE_LATENCY_SLO_MS,
    });
  },
);
