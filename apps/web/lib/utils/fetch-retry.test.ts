import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithRetry,
  sanitizeLogBody,
  _setRetryDelayFn,
} from "./fetch-retry";

// Stub out the retry delay so tests run instantly.
beforeEach(() => {
  _setRetryDelayFn(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchWithRetry", () => {
  it("retries once on 5xx and returns the successful 2nd response", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", {});

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it("does NOT retry on 429 (rate limit) — exactly 1 fetch attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(429);
  });

  it("does NOT retry on 2xx — exactly 1 fetch attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("returns the last 5xx response after exhausting all attempts", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", {});

    // MAX_RETRY_ATTEMPTS = 2 (1 initial + 1 retry)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(500);
  });
});

describe("sanitizeLogBody", () => {
  it("truncates a body longer than 200 chars and appends the ellipsis character", () => {
    const longBody = "a".repeat(250);
    const result = sanitizeLogBody(longBody);

    expect(result).toHaveLength(201); // 200 chars + "…" (single unicode character)
    expect(result).toBe("a".repeat(200) + "…");
  });

  it("returns a short body unchanged (under 200 chars)", () => {
    const shortBody = "hello world";
    const result = sanitizeLogBody(shortBody);

    expect(result).toBe("hello world");
  });

  it("strips ANSI escape sequences", () => {
    const ansiBody = "\x1b[31mred text\x1b[0m";
    const result = sanitizeLogBody(ansiBody);

    expect(result).toBe("red text");
  });

  it("strips ASCII control characters", () => {
    const controlBody = "line1\nline2\ttabbed";
    const result = sanitizeLogBody(controlBody);

    // \n (0x0A) and \t (0x09) are both in the 0x00–0x1F control range and get stripped
    expect(result).toBe("line1line2tabbed");
  });

  it("returns a body of exactly 200 chars unchanged", () => {
    const exactBody = "b".repeat(200);
    const result = sanitizeLogBody(exactBody);

    expect(result).toBe(exactBody);
    expect(result).toHaveLength(200);
  });
});
