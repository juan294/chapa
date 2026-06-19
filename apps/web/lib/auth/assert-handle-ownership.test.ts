import { describe, it, expect } from "vitest";
import { assertHandleOwnership } from "./assert-handle-ownership";

describe("assertHandleOwnership", () => {
  it("returns null (passes) when auth handle matches targetHandle exactly", () => {
    const result = assertHandleOwnership({ handle: "juan294" }, "juan294");
    expect(result).toBeNull();
  });

  it("returns null (passes) when auth handle matches targetHandle case-insensitively", () => {
    const result = assertHandleOwnership({ handle: "Juan294" }, "juan294");
    expect(result).toBeNull();
  });

  it("returns null (passes) when targetHandle is uppercase and auth handle is lowercase", () => {
    const result = assertHandleOwnership({ handle: "octocat" }, "OCTOCAT");
    expect(result).toBeNull();
  });

  it("returns a 403 Response when auth handle does not match targetHandle", () => {
    const result = assertHandleOwnership({ handle: "attacker" }, "victim");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("403 response body contains a meaningful error message", async () => {
    const result = assertHandleOwnership({ handle: "attacker" }, "victim");
    const body = await result!.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("returns null (passes) when auth is null and targetHandle matches — no, actually returns 401 for null auth", () => {
    // null auth means unauthenticated — must reject
    const result = assertHandleOwnership(null, "juan294");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 for undefined auth", () => {
    const result = assertHandleOwnership(undefined, "juan294");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns a Response (not throws) for all failure cases", () => {
    // Must never throw — always return a Response or null
    expect(() => assertHandleOwnership(null, "x")).not.toThrow();
    expect(() => assertHandleOwnership({ handle: "other" }, "x")).not.toThrow();
  });
});
