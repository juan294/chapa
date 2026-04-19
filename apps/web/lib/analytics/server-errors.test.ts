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
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_123",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
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

  it("fails silently when PostHog env vars are not configured", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

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
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

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
});

describe("withErrorCapture", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_123",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
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
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

    const { withErrorCapture } = await import("./server-errors");
    const { NextRequest } = await import("next/server");

    const boom = new Error("still thrown");
    const handler = vi.fn().mockRejectedValue(boom);
    const wrapped = withErrorCapture("/api/noop", handler);

    const req = new NextRequest("http://localhost/api/noop");
    await expect(wrapped(req, {})).rejects.toThrow("still thrown");
  });
});
