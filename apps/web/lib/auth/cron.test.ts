import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/crypto/safe-equal", () => ({
  safeEqual: (a: string, b: string) => a === b,
}));

describe("verifyCronSecret", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns null when CRON_SECRET is not set", async () => {
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    const result = verifyCronSecret(req);
    expect(result).toBeNull();
  });

  it("logs a warning when CRON_SECRET is not set", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    verifyCronSecret(req);
    expect(warnSpy).toHaveBeenCalledWith(
      "[cron] CRON_SECRET not configured — cron endpoints are unprotected"
    );
    warnSpy.mockRestore();
  });

  it("returns 401 when Authorization header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test");
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token does not match", async () => {
    process.env.CRON_SECRET = "test-secret";
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
    process.env.CRON_SECRET = "test-secret";
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).toBeNull();
  });

  it("trims whitespace from CRON_SECRET", async () => {
    process.env.CRON_SECRET = "  test-secret  \n";
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).toBeNull();
  });

  it("returns 401 when Authorization header is not Bearer format", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { verifyCronSecret } = await import("@/lib/auth/cron");
    const req = new NextRequest("https://example.com/api/cron/test", {
      headers: { Authorization: "Basic test-secret" },
    });
    const result = verifyCronSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
