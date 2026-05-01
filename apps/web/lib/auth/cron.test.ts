import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/crypto/safe-equal", () => ({
  safeEqual: (a: string, b: string) => a === b,
}));

describe("verifyCronSecret", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when CRON_SECRET is not set (fail-secure)", async () => {
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
    const body = await result!.json();
    expect(body.error).toBe("Cron secret not configured");
  });

  it("logs an error when CRON_SECRET is not set", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    verifyCronSecret(req);
    expect(errorSpy).toHaveBeenCalledWith(
      "[cron] CRON_SECRET not configured — rejecting request (fail-secure)"
    );
    errorSpy.mockRestore();
  });

  it("returns 401 when Authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token does not match", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns null (success) when token matches", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).toBeNull();
  });

  it("trims whitespace from CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "  test-secret  \n");
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).toBeNull();
  });

  it("returns 401 when Authorization header is not Bearer format", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Basic test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
