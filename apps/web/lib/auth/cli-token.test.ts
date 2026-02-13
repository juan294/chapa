import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { generateCliToken, verifyCliToken, isCliToken } from "./cli-token";

const SECRET = "test-secret-for-cli-tokens";

describe("generateCliToken", () => {
  it("returns a string with a dot separator", () => {
    const token = generateCliToken("juan294", SECRET);
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(2);
  });

  it("produces different tokens for different handles", () => {
    const t1 = generateCliToken("alice", SECRET);
    const t2 = generateCliToken("bob", SECRET);
    expect(t1).not.toBe(t2);
  });

  it("produces different tokens for different secrets", () => {
    const t1 = generateCliToken("alice", "secret-a");
    const t2 = generateCliToken("alice", "secret-b");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyCliToken", () => {
  it("verifies a valid token and returns the handle", () => {
    const token = generateCliToken("juan294", SECRET);
    const result = verifyCliToken(token, SECRET);
    expect(result).toEqual({ handle: "juan294" });
  });

  it("returns null for a tampered payload", () => {
    const token = generateCliToken("juan294", SECRET);
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ handle: "evil", type: "cli", iat: Date.now(), exp: Date.now() + 1e12 }),
    ).toString("base64url");
    const result = verifyCliToken(`${fakePayload}.${sig}`, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for a tampered signature", () => {
    const token = generateCliToken("juan294", SECRET);
    const [payload] = token.split(".");
    const result = verifyCliToken(`${payload}.badsig`, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const token = generateCliToken("juan294", SECRET);
    const result = verifyCliToken(token, "wrong-secret");
    expect(result).toBeNull();
  });

  it("returns null for expired token", () => {
    // Manually create an expired token
    const payload = {
      handle: "juan294",
      type: "cli" as const,
      iat: Date.now() - 200 * 24 * 60 * 60 * 1000,
      exp: Date.now() - 1000, // expired 1 second ago
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    const token = `${encoded}.${sig}`;

    const result = verifyCliToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for token without dot", () => {
    const result = verifyCliToken("nodottoken", SECRET);
    expect(result).toBeNull();
  });

  it("returns null for token with wrong type field", () => {
    const payload = {
      handle: "juan294",
      type: "session", // wrong type
      iat: Date.now(),
      exp: Date.now() + 1e12,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    const token = `${encoded}.${sig}`;

    const result = verifyCliToken(token, SECRET);
    expect(result).toBeNull();
  });
});

describe("isCliToken", () => {
  it("returns false for string with no dot", () => {
    expect(isCliToken("abc")).toBe(false);
  });

  it("returns true for valid format (two base64url parts separated by dot)", () => {
    expect(isCliToken("abc.def")).toBe(true);
  });

  it("returns true for a real generated CLI token", () => {
    const token = generateCliToken("juan294", SECRET);
    expect(isCliToken(token)).toBe(true);
  });

  it("returns false for GitHub PAT format (no dot, underscore prefix)", () => {
    expect(isCliToken("ghp_abc123")).toBe(false);
  });

  it("returns false when first part is empty", () => {
    expect(isCliToken(".abc")).toBe(false);
  });

  it("returns false when second part is empty", () => {
    expect(isCliToken("abc.")).toBe(false);
  });

  it("returns false for multiple dots", () => {
    expect(isCliToken("abc.def.ghi")).toBe(false);
  });

  it("returns false when signature contains invalid chars (space)", () => {
    expect(isCliToken("abc.de f")).toBe(false);
  });
});
