/**
 * Badge route latency SLO (#974).
 *
 * `/u/:handle/badge.svg` is the highest-traffic, most user-visible surface —
 * it is embedded in READMEs, so a slow render degrades the experience of every
 * viewer of that README, not just the badge owner. Historically there was no
 * defined latency budget, so slowdowns went undetected until user complaints.
 *
 * These p95 budgets define "acceptable" badge latency. The badge route emits a
 * `Server-Timing` header so per-request timing is inspectable, and the
 * `/api/cron/latency-check` synthetic monitor measures the live endpoint
 * against these budgets on a schedule, raising a P2 operational alert (via
 * `CHAPA_ALERT_WEBHOOK_URL`) on breach.
 *
 * Budgets:
 * - cache-hit  (warm SVG served straight from Redis): p95 ≤ 800ms
 * - cache-miss (materialize profile + render SVG):    p95 ≤ 3000ms
 */
export const BADGE_LATENCY_SLO_MS = {
  /** p95 budget for a warm cache-hit response served from Redis. */
  cacheHit: 800,
  /** p95 budget for a cold cache-miss (materialize + render) response. */
  cacheMiss: 3000,
} as const;

export interface BadgeLatencySample {
  /** Measured end-to-end response time in milliseconds. */
  durationMs: number;
  /** Whether the response was served from the warm SVG cache. */
  cacheHit: boolean;
}

export interface BadgeLatencyEvaluation {
  breached: boolean;
  durationMs: number;
  cacheHit: boolean;
  /** The budget the sample was measured against, in milliseconds. */
  budgetMs: number;
}

/**
 * Decide whether a single latency sample breaches its SLO budget.
 *
 * Pure function — the budget is selected by cache status and a sample breaches
 * only when it is strictly greater than the budget (equality is within SLO).
 */
export function evaluateBadgeLatency(
  sample: BadgeLatencySample,
): BadgeLatencyEvaluation {
  const budgetMs = sample.cacheHit
    ? BADGE_LATENCY_SLO_MS.cacheHit
    : BADGE_LATENCY_SLO_MS.cacheMiss;
  return {
    breached: sample.durationMs > budgetMs,
    durationMs: sample.durationMs,
    cacheHit: sample.cacheHit,
    budgetMs,
  };
}

export interface ServerTimingEntry {
  /** Metric name, e.g. "cache", "render", "total". */
  name: string;
  /** Duration in milliseconds. */
  durMs: number;
  /** Optional human-readable description, e.g. "hit". */
  desc?: string;
}

/**
 * Serialize metrics into a `Server-Timing` header value per the W3C spec:
 * `name;desc="...";dur=NN, other;dur=NN`.
 */
export function formatServerTiming(entries: ServerTimingEntry[]): string {
  return entries
    .map((entry) => {
      const parts = [entry.name];
      if (entry.desc) parts.push(`desc="${entry.desc}"`);
      parts.push(`dur=${entry.durMs}`);
      return parts.join(";");
    })
    .join(", ");
}

/**
 * True when a `Server-Timing` header string reports a `cache` metric, which the
 * badge route only emits on the warm cache-hit path. The synthetic monitor uses
 * this to pick the correct SLO budget for the measured response.
 */
export function serverTimingIndicatesCacheHit(header: string): boolean {
  return /\bcache;/.test(header);
}
