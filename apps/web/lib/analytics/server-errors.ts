/**
 * Server-side error monitoring via PostHog.
 *
 * Sends `server_error` events to PostHog's capture API using plain fetch.
 * No new dependencies required — uses the same NEXT_PUBLIC_POSTHOG_KEY
 * and NEXT_PUBLIC_POSTHOG_HOST env vars as the client-side SDK.
 *
 * Design:
 * - Fire-and-forget: never throws, never blocks the response
 * - Strips sensitive data (tokens, secrets, API keys) from messages and stacks
 * - Truncates stack traces to 1024 chars to avoid oversized payloads
 * - Fails silently when PostHog is unavailable or unconfigured
 */

/** Patterns that match sensitive values in error messages and stack traces. */
const SENSITIVE_PATTERNS = [
  // GitHub tokens (classic and fine-grained)
  /ghp_[A-Za-z0-9_]{36,}/g,
  /github_pat_[A-Za-z0-9_]{82,}/g,
  /gho_[A-Za-z0-9_]{36,}/g,
  /ghs_[A-Za-z0-9_]{36,}/g,
  /ghu_[A-Za-z0-9_]{36,}/g,
  // Generic secret assignment patterns (key=value, key: value)
  /(?:token|secret|key|password|credential|authorization|bearer)\s*[=:]\s*\S+/gi,
  // API keys with common prefixes
  /sk-[A-Za-z0-9]{20,}/g,
  /pk_[A-Za-z0-9]{20,}/g,
  // Bearer tokens in headers
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
];

/** Remove sensitive data from a string. */
function sanitize(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/** Maximum length for stack traces in the payload. */
const MAX_STACK_LENGTH = 1024;

export interface CaptureServerErrorOptions {
  /** The API route that produced the error (e.g., "/api/auth/callback"). */
  route: string;
  /** HTTP status code returned to the client. */
  statusCode: number;
  /** The error object, string, or unknown value. */
  error: unknown;
}

/**
 * Capture a server-side error and send it to PostHog as a `server_error` event.
 *
 * This is a fire-and-forget function: it never throws, never blocks the response,
 * and fails silently if PostHog is unavailable.
 */
export async function captureServerError(
  options: CaptureServerErrorOptions,
): Promise<void> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!apiKey || !host) return;

    const { route, statusCode, error } = options;

    // Extract error details based on type
    let errorType: string;
    let message: string;
    let stack: string | undefined;

    if (error instanceof Error) {
      errorType = error.name;
      message = sanitize(error.message);
      stack = error.stack
        ? sanitize(error.stack).slice(0, MAX_STACK_LENGTH)
        : undefined;
    } else if (typeof error === "string") {
      errorType = "string";
      message = sanitize(error);
    } else {
      errorType = typeof error;
      message = sanitize(
        typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error),
      );
    }

    const payload = {
      api_key: apiKey,
      event: "server_error",
      distinct_id: "chapa-server",
      properties: {
        route,
        statusCode,
        errorType,
        message,
        ...(stack !== undefined && { stack }),
      },
    };

    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never let monitoring crash the app — silently swallow all errors
  }
}
