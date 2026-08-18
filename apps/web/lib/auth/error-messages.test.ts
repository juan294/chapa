import { describe, it, expect } from "vitest";
import { getOAuthErrorMessage, OAUTH_ERROR_CODES } from "./error-messages";
import { es } from "@/lib/i18n/dictionaries/es";
import { en } from "@/lib/i18n/dictionaries/en";
import { resolveTranslation } from "@/lib/i18n/resolve";

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

  // #1109 (UX-H3): OAuth error messages must render in the visitor's locale,
  // not a hardcoded English literal.
  describe("i18n (#1109)", () => {
    it("uses the English dictionary by default (no translator passed)", () => {
      expect(getOAuthErrorMessage("no_code")).toBe(
        resolveTranslation("oauthErrors.noCode", en),
      );
    });

    it("resolves the Spanish message when given a Spanish translator", () => {
      const esT = (key: string) => resolveTranslation(key, es) as string;
      const knownCodes = [
        "no_code",
        "invalid_state",
        "config",
        "token_exchange",
        "user_fetch",
      ] as const;
      for (const code of knownCodes) {
        const msg = getOAuthErrorMessage(code, esT);
        expect(msg).toBeTruthy();
        expect(msg).not.toBe(getOAuthErrorMessage(code));
      }
    });

    it("resolves the Spanish fallback for an unknown code", () => {
      const esT = (key: string) => resolveTranslation(key, es) as string;
      const msg = getOAuthErrorMessage("unknown_error_xyz", esT);
      expect(msg).toBe(resolveTranslation("oauthErrors.fallback", es));
    });
  });
});
