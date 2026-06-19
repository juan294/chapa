/**
 * Shared fetch-retry utilities for platform query modules.
 *
 * Provides:
 *   - `fetchWithRetry`: bounded jittered retry for idempotent reads (GET / GraphQL).
 *     Retries on 5xx responses only; never retries 4xx or non-idempotent writes.
 *   - `sanitizeLogBody`: truncates and strips control chars from upstream error bodies
 *     before writing to logs (BE-M4 / #870).
 */

const MAX_RETRY_ATTEMPTS = 2; // 1 initial + 1 retry
const BASE_DELAY_MS = 300;

/** Returns true for transient server errors that are safe to retry. */
function isRetryable(status: number): boolean {
  return status >= 500 && status <= 599;
}

/**
 * Delay function — injectable for testing.
 * Tests can override this to skip sleeps without needing fake timer management.
 */
export let _retryDelayFn: (ms: number) => Promise<void> = (ms) =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Override the retry delay in tests (call with `() => Promise.resolve()` to skip delays).
 * This is a test-only escape hatch; production code never calls this.
 */
export function _setRetryDelayFn(fn: (ms: number) => Promise<void>): void {
  _retryDelayFn = fn;
}

/**
 * Fetch with bounded jittered retry for idempotent reads.
 *
 * - Retries once on 5xx (total: 2 attempts).
 * - Does NOT retry 4xx (auth failures, rate-limit 429 = 4xx → no retry for 429).
 * - Adds a small jittered delay between attempts to avoid thundering herds.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // Jitter: BASE_DELAY_MS ± 50%
      const jitter = BASE_DELAY_MS * (0.75 + Math.random() * 0.5);
      await _retryDelayFn(jitter);
    }

    const res = await fetch(url, init);

    if (!isRetryable(res.status)) {
      // 2xx, 4xx (including 429), or any non-5xx → return immediately
      return res;
    }

    lastResponse = res;
  }

  // All attempts exhausted — return the last response for the caller to handle
  return lastResponse!;
}

/**
 * Sanitize an upstream error body for safe logging.
 *
 * - Strips ANSI escape sequences and ASCII control characters (0x00–0x1F, 0x7F).
 * - Truncates to MAX_BODY_LOG_CHARS characters.
 */
const MAX_BODY_LOG_CHARS = 200;

export function sanitizeLogBody(raw: string): string {
  // Strip ANSI escape sequences (ESC [ ... m patterns and similar) and ASCII control chars.
  const stripped = raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "");
  return stripped.length > MAX_BODY_LOG_CHARS
    ? `${stripped.slice(0, MAX_BODY_LOG_CHARS)}…`
    : stripped;
}
