import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally so no real HTTP calls are made
const mockFetch = vi.fn();

/** Safely extract the parsed body from the first fetch call. */
function getCallBody(): Record<string, unknown> {
  const call = mockFetch.mock.calls[0] as [string, { body: string }] | undefined;
  expect(call).toBeDefined();
  return JSON.parse(call![1].body);
}

describe("captureServerError", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_123");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a server_error event with error name, message, and route", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: new Error("Token exchange failed"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(call[0]).toBe("https://us.i.posthog.com/capture/");
    expect(call[1].method).toBe("POST");

    const body = JSON.parse(call[1].body) as Record<string, unknown>;
    expect(body.api_key).toBe("phc_test_key_123");
    expect(body.event).toBe("server_error");

    const props = body.properties as Record<string, unknown>;
    expect(props.route).toBe("/api/auth/callback");
    expect(props.statusCode).toBe(500);
    expect(props.errorType).toBe("Error");
    expect(props.message).toBe("Token exchange failed");
  });

  it("includes a truncated stack trace", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    const error = new Error("Something broke");
    // Ensure there's a stack
    expect(error.stack).toBeDefined();

    await captureServerError({
      route: "/u/test/badge.svg",
      statusCode: 500,
      error,
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.stack).toBeDefined();
    expect(typeof props.stack).toBe("string");
    // Stack should be truncated to a reasonable length
    expect((props.stack as string).length).toBeLessThanOrEqual(1024);
  });

  it("does NOT include sensitive data like tokens, secrets, or API keys", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    const sensitiveError = new Error(
      "Auth failed: token=ghp_abc123secret secret_key=sk-abc GITHUB_CLIENT_SECRET=mysecret",
    );

    await captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: sensitiveError,
    });

    const body = getCallBody();
    const payload = JSON.stringify(body);

    // Must not contain raw secret values
    expect(payload).not.toContain("ghp_abc123secret");
    expect(payload).not.toContain("sk-abc");
    expect(payload).not.toContain("mysecret");
  });

  it.each([
    ["ghp token", "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890"],
    [
      "github fine-grained token",
      `github_pat_${"a".repeat(82)}`,
    ],
    ["gho token", "gho_abcdefghijklmnopqrstuvwxyz1234567890"],
    ["ghs token", "ghs_abcdefghijklmnopqrstuvwxyz1234567890"],
    ["ghu token", "ghu_abcdefghijklmnopqrstuvwxyz1234567890"],
    ["generic secret assignment", "authorization=super-secret-value"],
    ["secret key prefix", "sk-abcdefghijklmnopqrstuvwx123456"],
    ["public key prefix", "pk_abcdefghijklmnopqrstuvwx123456"],
    ["bearer token", "Bearer abc.def-ghi_jkl"],
  ])("redacts %s patterns", async (_label, sensitiveValue) => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error(`failed: ${sensitiveValue}`),
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    const message = String(props.message);

    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(sensitiveValue);
  });

  it("fails silently when PostHog env vars are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", undefined);

    const { captureServerError } = await import("./server-errors");

    // Should not throw
    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails silently when PostHog key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails silently when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    const { captureServerError } = await import("./server-errors");

    // Must not throw — fire-and-forget behavior
    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("original error"),
    });

    // fetch was attempted but failed silently
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fails silently when fetch returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    const { captureServerError } = await import("./server-errors");

    // Must not throw
    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("works as fire-and-forget (returns void, does not throw)", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    const result = await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    expect(result).toBeUndefined();
  });

  it("handles non-Error objects gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: "string error",
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.errorType).toBe("string");
    expect(props.message).toBe("string error");
  });

  it("handles object errors without stack", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 502,
      error: { code: "ECONNREFUSED" },
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.errorType).toBe("object");
    expect(props.statusCode).toBe(502);
  });

  it("uses a distinct_id of 'chapa-server' for server events", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    const body = getCallBody();
    expect(body.distinct_id).toBe("chapa-server");
  });

  it("strips tokens from stack traces too", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    const error = new Error("failed");
    error.stack = `Error: failed\n    at fetchToken (token=ghp_secrettoken123)\n    at main`;

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error,
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.stack).not.toContain("ghp_secrettoken123");
  });

  it("passes an AbortSignal to the PostHog fetch call", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends an active alert for launch-critical badge 5xx errors", async () => {
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/u/octocat/badge.svg",
      statusCode: 500,
      error: new Error("render failed token=ghp_abcdefghijklmnopqrstuvwxyz1234567890"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url, opts] = mockFetch.mock.calls[1] as [string, { body: string }];
    expect(url).toBe("https://alerts.example.com/chapa");

    const body = JSON.parse(opts.body) as Record<string, unknown>;
    expect(body.signal).toBe("badge_5xx");
    expect(body.severity).toBe("P1");
    expect(body.route).toBe("/u/octocat/badge.svg");
    expect(JSON.stringify(body)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
  });

  it("does not alert for non-critical server errors", async () => {
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/test",
      statusCode: 500,
      error: new Error("test"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["/api/auth/callback", "oauth_callback_failure", "P1"],
    ["/api/cron/warm-cache", "cron_failure", "P2"],
  ])("alerts for %s failures", async (route, signal, severity) => {
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route,
      statusCode: 502,
      error: new Error("test"),
    });

    const [, opts] = mockFetch.mock.calls[1] as [string, { body: string }];
    const body = JSON.parse(opts.body) as Record<string, unknown>;
    expect(body.signal).toBe(signal);
    expect(body.severity).toBe(severity);
  });

  it("still sends active alerts when PostHog delivery fails", async () => {
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
    mockFetch
      .mockRejectedValueOnce(new Error("PostHog down"))
      .mockResolvedValueOnce({ ok: true });

    const { captureServerError } = await import("./server-errors");

    await captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: new Error("oauth failed"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url, opts] = mockFetch.mock.calls[1] as [string, { body: string }];
    expect(url).toBe("https://alerts.example.com/chapa");
    const body = JSON.parse(opts.body) as Record<string, unknown>;
    expect(body.signal).toBe("oauth_callback_failure");
  });
});

describe("captureOperationalAlert", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts a structured alert payload to the configured webhook", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureOperationalAlert } = await import("./server-errors");

    await captureOperationalAlert({
      signal: "health_degraded",
      severity: "P1",
      summary: "Health check is degraded",
      route: "/api/health",
      properties: {
        token: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        dependencies: { redis: "error" },
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://alerts.example.com/chapa",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );

    const body = getCallBody();
    expect(body.source).toBe("chapa");
    expect(body.signal).toBe("health_degraded");
    expect(body.severity).toBe("P1");
    expect(body.route).toBe("/api/health");
    expect(JSON.stringify(body)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
  });

  it("does not send when the alert webhook is not configured", async () => {
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", undefined);

    const { captureOperationalAlert } = await import("./server-errors");

    await captureOperationalAlert({
      signal: "health_degraded",
      severity: "P1",
      summary: "Health check is degraded",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("captureServerEvent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_123");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends arbitrary server events with provided properties", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerEvent } = await import("./server-errors");

    await captureServerEvent("cron_warm_cache_complete", {
      handlesProcessed: 12,
      cacheHitRate: 0.9,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = getCallBody();
    expect(body.api_key).toBe("phc_test_key_123");
    expect(body.event).toBe("cron_warm_cache_complete");
    expect(body.distinct_id).toBe("chapa-server");
    expect(body.properties).toEqual({
      handlesProcessed: 12,
      cacheHitRate: 0.9,
    });
  });

  it("defaults properties to an empty object when omitted", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { captureServerEvent } = await import("./server-errors");

    await captureServerEvent("cron_warm_cache_complete");

    const body = getCallBody();
    expect(body.properties).toEqual({});
  });

  it("fails silently when PostHog is unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", undefined);

    const { captureServerEvent } = await import("./server-errors");

    await captureServerEvent("cron_warm_cache_complete", {
      handlesProcessed: 12,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails silently when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    const { captureServerEvent } = await import("./server-errors");

    await captureServerEvent("cron_warm_cache_complete", {
      handlesProcessed: 12,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("sanitizeUnknown — branch coverage for nested property types", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://alerts.example.com/chapa");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes null, number, and boolean values through unchanged in nested properties", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { captureOperationalAlert } = await import("./server-errors");

    await captureOperationalAlert({
      signal: "health_degraded",
      severity: "P2",
      summary: "test",
      properties: {
        nullVal: null,
        count: 42,
        active: true,
      },
    });

    const body = getCallBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.nullVal).toBeNull();
    expect(props.count).toBe(42);
    expect(props.active).toBe(true);
  });

  it("sanitizes sensitive strings within nested arrays", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { captureOperationalAlert } = await import("./server-errors");

    await captureOperationalAlert({
      signal: "health_degraded",
      severity: "P2",
      summary: "test",
      properties: {
        tokens: ["ghp_abcdefghijklmnopqrstuvwxyz1234567890", "safe-value"],
      },
    });

    const body = getCallBody();
    const tokens = (body.properties as Record<string, unknown[]>).tokens ?? [];
    expect(tokens[0]).toBe("[REDACTED]");
    expect(tokens[1]).toBe("safe-value");
  });
});

describe("withErrorCapture", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_123");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes through successful handler responses unchanged", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { withErrorCapture } = await import("./server-errors");
    const { NextRequest, NextResponse } = await import("next/server");

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withErrorCapture("/api/test", handler);

    const req = new NextRequest("http://localhost/api/test");
    const res = await wrapped(req, {});

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    // captureServerError should NOT be called on success
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls captureServerError and re-throws when handler throws", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { withErrorCapture } = await import("./server-errors");
    const { NextRequest } = await import("next/server");

    const boom = new Error("DB exploded");
    const handler = vi.fn().mockRejectedValue(boom);
    const wrapped = withErrorCapture("/api/explode", handler);

    const req = new NextRequest("http://localhost/api/explode");

    await expect(wrapped(req, {})).rejects.toThrow("DB exploded");

    // captureServerError fires a fetch call to PostHog
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("posthog.com");
    const body = JSON.parse(opts.body) as { properties: { route: string } };
    expect(body.properties.route).toBe("/api/explode");
  });

  it("re-throws the original error instance", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { withErrorCapture } = await import("./server-errors");
    const { NextRequest } = await import("next/server");

    const original = new TypeError("type mismatch");
    const handler = vi.fn().mockRejectedValue(original);
    const wrapped = withErrorCapture("/api/types", handler);

    const req = new NextRequest("http://localhost/api/types");

    await expect(wrapped(req, {})).rejects.toBe(original);
  });

  it("does not swallow the error even when captureServerError is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", undefined);

    const { withErrorCapture } = await import("./server-errors");
    const { NextRequest } = await import("next/server");

    const boom = new Error("still thrown");
    const handler = vi.fn().mockRejectedValue(boom);
    const wrapped = withErrorCapture("/api/noop", handler);

    const req = new NextRequest("http://localhost/api/noop");
    await expect(wrapped(req, {})).rejects.toThrow("still thrown");
  });
});
