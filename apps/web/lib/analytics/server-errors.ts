/**
 * Server-side error monitoring via PostHog and optional active alerts.
 *
 * Sends `server_error` events to PostHog's capture API using plain fetch.
 * No new dependencies required — uses the same NEXT_PUBLIC_POSTHOG_KEY
 * and NEXT_PUBLIC_POSTHOG_HOST env vars as the client-side SDK.
 *
 * Design:
 * - Fire-and-forget: never throws, never blocks the response
 * - Strips sensitive data (tokens, secrets, API keys) from messages and stacks
 * - Truncates stack traces to 1024 chars to avoid oversized payloads
 * - Fails silently when monitoring is unavailable or unconfigured
 */

import type { NextRequest, NextResponse } from "next/server";
import { getRequestId } from "@/lib/log";
import { getChapaAlertWebhookUrl, getPosthogKey, getPosthogHost } from "@/lib/env";
import { sendAlertEmail } from "@/lib/email/alerts";

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
  /** Request correlation ID for tracing across a request chain. */
  requestId?: string;
}

export interface OperationalAlertOptions {
  /** Machine-readable signal name, e.g. "health_degraded". */
  signal: string;
  /** Incident severity used by the runbook. */
  severity: "P1" | "P2" | "P3" | "P4";
  /** Short human-readable alert summary. */
  summary: string;
  /** Route or subsystem that emitted the alert. */
  route?: string;
  /** Extra structured context. Sensitive strings are redacted recursively. */
  properties?: Record<string, unknown>;
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return sanitize(value);
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(sanitizeUnknown);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        sanitizeUnknown(child),
      ]),
    );
  }
  return sanitize(String(value));
}

function classifyLaunchCriticalError(
  route: string,
  statusCode: number,
): Pick<OperationalAlertOptions, "signal" | "severity" | "summary"> | null {
  if (statusCode < 500) return null;

  if (route.includes("/badge.svg")) {
    return {
      signal: "badge_5xx",
      severity: "P1",
      summary: "Badge SVG route returned a 5xx error",
    };
  }
  if (route === "/api/auth/callback") {
    return {
      signal: "oauth_callback_failure",
      severity: "P1",
      summary: "OAuth callback returned a 5xx error",
    };
  }
  if (route.startsWith("/api/cron/")) {
    return {
      signal: "cron_failure",
      severity: "P2",
      summary: "Cron route returned a 5xx error",
    };
  }

  return null;
}

export async function captureOperationalAlert(
  options: OperationalAlertOptions,
): Promise<void> {
  try {
    const webhookUrl = getChapaAlertWebhookUrl();

    const payload = {
      source: "chapa",
      timestamp: new Date().toISOString(),
      signal: options.signal,
      severity: options.severity,
      summary: sanitize(options.summary),
      ...(options.route && { route: options.route }),
      properties: sanitizeUnknown(options.properties ?? {}) as Record<string, unknown>,
    };

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return;
    }

    // #1162 / DO-B1: no Discord/Slack — CHAPA_ALERT_WEBHOOK_URL is unset in
    // production, so fall back to email via the existing Resend client
    // rather than dropping the alert. sendAlertEmail never throws on its
    // own, but this call still sits inside the outer try/catch below so a
    // future change to that contract can't take down the request path.
    await sendAlertEmail(payload);
  } catch {
    // Never let alert delivery affect the request path.
  }
}

/**
 * Send an arbitrary server-side event to PostHog.
 *
 * This is a fire-and-forget function: it never throws, never blocks the response,
 * and fails silently if PostHog is unavailable or unconfigured.
 *
 * @param event  - Event name (e.g. "cron_warm_cache_complete")
 * @param properties - Arbitrary key-value properties attached to the event
 */
export async function captureServerEvent(
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const apiKey = getPosthogKey();
    const host = getPosthogHost();

    if (!apiKey || !host) return;

    const payload = {
      api_key: apiKey,
      event,
      distinct_id: "chapa-server",
      // #1162 / BE-M4: sanitize like captureServerError does — a caller can
      // pass raw request/error context through here (e.g. the telemetry
      // route forwards client-reported error messages), and this event has
      // no other redaction boundary before it leaves the process.
      properties: sanitizeUnknown(properties ?? {}) as Record<string, unknown>,
    };

    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Never let monitoring crash the app — silently swallow all errors
  }
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
    const apiKey = getPosthogKey();
    const host = getPosthogHost();

    const { route, statusCode, error, requestId } = options;

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

    const properties = {
      route,
      statusCode,
      errorType,
      message,
      ...(stack !== undefined && { stack }),
      ...(requestId !== undefined && { requestId }),
    };

    try {
      if (apiKey && host) {
        const payload = {
          api_key: apiKey,
          event: "server_error",
          distinct_id: "chapa-server",
          properties,
        };

        await fetch(`${host}/capture/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch {
      // PostHog delivery failure must not suppress active alerts below.
    }

    const alert = classifyLaunchCriticalError(route, statusCode);
    if (alert) {
      await captureOperationalAlert({
        ...alert,
        route,
        properties,
      });
    }
  } catch {
    // Never let monitoring crash the app — silently swallow all errors
  }
}

/** Route handler type compatible with Next.js App Router. */
type RouteHandler = (
  req: NextRequest,
  ctx?: unknown,
) => Promise<NextResponse | Response>;

/**
 * Wrap a Next.js route handler to capture unhandled errors in PostHog.
 *
 * Re-throws the original error so the framework generates a 500 response.
 * Never swallows errors.
 *
 * Usage:
 *   export const GET = withErrorCapture("/api/my-route", async (req) => { ... });
 */
export function withErrorCapture(
  route: string,
  handler: RouteHandler,
): RouteHandler {
  return async (req: NextRequest, ctx?: unknown) => {
    const requestId = getRequestId(req);
    try {
      return await handler(req, ctx);
    } catch (err) {
      void captureServerError({ route, statusCode: 500, error: err, requestId });
      throw err;
    }
  };
}
