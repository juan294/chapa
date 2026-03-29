import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { isAdminHandle, verifyAdminSecret } from "./admin";

vi.mock("@/lib/crypto/safe-equal", () => ({
  safeEqual: (a: string, b: string) => a === b,
}));

describe("verifyAdminSecret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when token matches ADMIN_SECRET", () => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-123");
    const request = new NextRequest("http://localhost/api/admin/stats", {
      headers: { Authorization: "Bearer test-secret-123" },
    });

    const result = verifyAdminSecret(request);
    expect(result).toBeNull();
  });

  it("returns 401 when Authorization header is missing", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-123");
    const request = new NextRequest("http://localhost/api/admin/stats");

    const result = verifyAdminSecret(request);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);

    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token does not match", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-123");
    const request = new NextRequest("http://localhost/api/admin/stats", {
      headers: { Authorization: "Bearer wrong-token" },
    });

    const result = verifyAdminSecret(request);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);

    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns null when ADMIN_SECRET env var is not set", () => {
    vi.stubEnv("ADMIN_SECRET", "");
    const request = new NextRequest("http://localhost/api/admin/stats");

    const result = verifyAdminSecret(request);
    expect(result).toBeNull();
  });

  it("trims whitespace from ADMIN_SECRET", () => {
    vi.stubEnv("ADMIN_SECRET", "  test-secret-123  ");
    const request = new NextRequest("http://localhost/api/admin/stats", {
      headers: { Authorization: "Bearer test-secret-123" },
    });

    const result = verifyAdminSecret(request);
    expect(result).toBeNull();
  });

  it("returns 401 when Authorization header is not Bearer format", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-123");
    const request = new NextRequest("http://localhost/api/admin/stats", {
      headers: { Authorization: "Basic test-secret-123" },
    });

    const result = verifyAdminSecret(request);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

describe("isAdminHandle", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when ADMIN_HANDLES is not set", () => {
    vi.stubEnv("ADMIN_HANDLES", "");
    expect(isAdminHandle("juan294")).toBe(false);
  });

  it("returns true for a matching handle (case-insensitive)", () => {
    vi.stubEnv("ADMIN_HANDLES", "juan294,admin2");
    expect(isAdminHandle("juan294")).toBe(true);
    expect(isAdminHandle("Juan294")).toBe(true);
    expect(isAdminHandle("JUAN294")).toBe(true);
  });

  it("returns false for a non-matching handle", () => {
    vi.stubEnv("ADMIN_HANDLES", "juan294,admin2");
    expect(isAdminHandle("notadmin")).toBe(false);
  });

  it("handles whitespace in ADMIN_HANDLES", () => {
    vi.stubEnv("ADMIN_HANDLES", " juan294 , admin2 ");
    expect(isAdminHandle("juan294")).toBe(true);
    expect(isAdminHandle("admin2")).toBe(true);
  });

  it("handles single handle", () => {
    vi.stubEnv("ADMIN_HANDLES", "juan294");
    expect(isAdminHandle("juan294")).toBe(true);
    expect(isAdminHandle("other")).toBe(false);
  });

  it("returns false for empty handle input", () => {
    vi.stubEnv("ADMIN_HANDLES", "juan294");
    expect(isAdminHandle("")).toBe(false);
  });
});
