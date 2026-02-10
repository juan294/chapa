import { describe, it, expect } from "vitest";
import { getOAuthErrorMessage, OAUTH_ERROR_CODES } from "./error-messages";

describe("getOAuthErrorMessage", () => {
  it("returns a user-friendly message for 'no_code'", () => {
    const result = getOAuthErrorMessage("no_code");
    expect(result).toBeTruthy();
    expect(result).not.toContain("no_code");
  });

  it("returns a user-friendly message for 'invalid_state'", () => {
    const result = getOAuthErrorMessage("invalid_state");
    expect(result).toBeTruthy();
    expect(result).not.toContain("invalid_state");
  });

  it("returns a user-friendly message for 'config'", () => {
    const result = getOAuthErrorMessage("config");
    expect(result).toBeTruthy();
    expect(result).not.toContain("config");
  });

  it("returns a user-friendly message for 'token_exchange'", () => {
    const result = getOAuthErrorMessage("token_exchange");
    expect(result).toBeTruthy();
    expect(result).not.toContain("token_exchange");
  });

  it("returns a user-friendly message for 'user_fetch'", () => {
    const result = getOAuthErrorMessage("user_fetch");
    expect(result).toBeTruthy();
    expect(result).not.toContain("user_fetch");
  });

  it("returns a generic fallback for unknown error codes", () => {
    const result = getOAuthErrorMessage("unknown_error_xyz");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns null for undefined/null/empty input", () => {
    expect(getOAuthErrorMessage(undefined)).toBeNull();
    expect(getOAuthErrorMessage(null)).toBeNull();
    expect(getOAuthErrorMessage("")).toBeNull();
  });

  it("every known error code has a mapped message", () => {
    const knownCodes = ["no_code", "invalid_state", "config", "token_exchange", "user_fetch"];
    for (const code of knownCodes) {
      expect(OAUTH_ERROR_CODES).toContain(code);
      expect(getOAuthErrorMessage(code)).toBeTruthy();
    }
  });

  it("messages are non-technical and user-friendly", () => {
    const knownCodes = ["no_code", "invalid_state", "config", "token_exchange", "user_fetch"];
    for (const code of knownCodes) {
      const msg = getOAuthErrorMessage(code)!;
      // Messages should not expose internal error codes
      expect(msg).not.toMatch(/code|state|token|config|fetch/i);
      // Messages should be reasonably short
      expect(msg.length).toBeLessThan(200);
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});
