import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("log", () => {
  const ORIGINAL_ENV = process.env;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env = { ...ORIGINAL_ENV, VERCEL_ENV: "test" };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env = ORIGINAL_ENV;
  });

  it("log.info emits valid JSON with required fields", async () => {
    const { log } = await import("./log");
    log.info("hello world");

    expect(consoleSpy).toHaveBeenCalledOnce();
    const raw = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello world");
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts as string).toISOString()).toBe(parsed.ts);
    expect(parsed.env).toBe("test");
  });

  it("log.warn emits level=warn", async () => {
    const { log } = await import("./log");
    log.warn("watch out");

    const raw = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe("warn");
    expect(parsed.msg).toBe("watch out");
  });

  it("log.error emits level=error", async () => {
    const { log } = await import("./log");
    log.error("something broke");

    const raw = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe("error");
  });

  it("includes extra fields spread into the log entry", async () => {
    const { log } = await import("./log");
    log.info("with extras", { route: "/api/profile", requestId: "req-123" });

    const raw = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.route).toBe("/api/profile");
    expect(parsed.requestId).toBe("req-123");
  });

  it("includes VERCEL_ENV as env field", async () => {
    process.env.VERCEL_ENV = "production";
    const { log } = await import("./log");
    log.info("prod log");

    const raw = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.env).toBe("production");
  });

  it("outputs valid JSON (parseable string)", async () => {
    const { log } = await import("./log");
    log.error("json check");

    const raw = consoleSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
