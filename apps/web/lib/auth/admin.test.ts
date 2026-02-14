import { describe, it, expect, beforeEach, vi } from "vitest";
import { isAdminHandle } from "./admin";

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
