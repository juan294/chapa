import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("log", () => {
  const ORIGINAL_ENV = process.env;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env = { ...ORIGINAL_ENV, VERCEL_ENV: "test" };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env = ORIGINAL_ENV;
  });

  it("log('info') emits valid JSON with required fields via console.log", async () => {
    const { log } = await import("./log");
    log("info", "hello world");

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    const raw = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello world");
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts as string).toISOString()).toBe(parsed.ts);
    expect(parsed.env).toBe("test");
  });

  it("log('debug') emits via console.log", async () => {
    const { log } = await import("./log");
    log("debug", "debug message");

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    const raw = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe("debug");
    expect(parsed.msg).toBe("debug message");
  });

  it("log('warn') emits via console.error (not console.log)", async () => {
    const { log } = await import("./log");
    log("warn", "watch out");

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    const raw = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe("warn");
    expect(parsed.msg).toBe("watch out");
  });

  it("log('error') emits via console.error (not console.log)", async () => {
    const { log } = await import("./log");
    log("error", "something broke");

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    const raw = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe("error");
  });

  it("includes context fields spread into the log entry", async () => {
    const { log } = await import("./log");
    log("info", "with context", { route: "/api/profile", requestId: "req-123", handle: "juan" });

    const raw = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.route).toBe("/api/profile");
    expect(parsed.requestId).toBe("req-123");
    expect(parsed.handle).toBe("juan");
  });

  it("includes VERCEL_ENV as env field", async () => {
    process.env.VERCEL_ENV = "production";
    const { log } = await import("./log");
    log("info", "prod log");

    const raw = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.env).toBe("production");
  });

  it("outputs valid JSON (parseable string)", async () => {
    const { log } = await import("./log");
    log("error", "json check");

    const raw = consoleErrorSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe("getRequestId", () => {
  it("returns x-vercel-id header when present", async () => {
    const { getRequestId } = await import("./log");
    const req = new Request("https://example.com", {
      headers: { "x-vercel-id": "iad1::abc123" },
    });
    expect(getRequestId(req)).toBe("iad1::abc123");
  });

  it("falls back to a UUID when x-vercel-id is absent", async () => {
    const { getRequestId } = await import("./log");
    const req = new Request("https://example.com");
    const id = getRequestId(req);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns different IDs on successive calls without x-vercel-id", async () => {
    const { getRequestId } = await import("./log");
    const req1 = new Request("https://example.com");
    const req2 = new Request("https://example.com");
    expect(getRequestId(req1)).not.toBe(getRequestId(req2));
  });
});
