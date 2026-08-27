import { describe, it, expect } from "vitest";
import { getOAuthErrorMessage, OAUTH_ERROR_CODES } from "./error-messages";
import { es } from "@/lib/i18n/dictionaries/es";
import { en } from "@/lib/i18n/dictionaries/en";
import { resolveTranslation } from "@/lib/i18n/resolve";

// #1164 (FE-H1/PE-H1): `getOAuthErrorMessage` no longer defaults `t` to a
// statically-imported English dictionary (that default was dead in the
// client path and pulled the dictionary into every client bundle). Tests
// that previously relied on the default now pass this explicit translator.
const enT = (key: string) => resolveTranslation(key, en) as string;

describe("getOAuthErrorMessage", () => {
  it("returns a user-friendly message for 'no_code'", () => {
    const result = getOAuthErrorMessage("no_code", enT);
    expect(result).toBeTruthy();
    expect(result).not.toContain("no_code");
  });

  it("returns a user-friendly message for 'invalid_state'", () => {
    const result = getOAuthErrorMessage("invalid_state", enT);
    expect(result).toBeTruthy();
    expect(result).not.toContain("invalid_state");
  });

  it("returns a user-friendly message for 'config'", () => {
    const result = getOAuthErrorMessage("config", enT);
    expect(result).toBeTruthy();
    expect(result).not.toContain("config");
  });

  it("returns a user-friendly message for 'token_exchange'", () => {
    const result = getOAuthErrorMessage("token_exchange", enT);
    expect(result).toBeTruthy();
    expect(result).not.toContain("token_exchange");
  });

  it("returns a user-friendly message for 'user_fetch'", () => {
    const result = getOAuthErrorMessage("user_fetch", enT);
    expect(result).toBeTruthy();
    expect(result).not.toContain("user_fetch");
  });

  it("returns a generic fallback for unknown error codes", () => {
    const result = getOAuthErrorMessage("unknown_error_xyz", enT);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns null for undefined/null/empty input", () => {
    expect(getOAuthErrorMessage(undefined, enT)).toBeNull();
    expect(getOAuthErrorMessage(null, enT)).toBeNull();
    expect(getOAuthErrorMessage("", enT)).toBeNull();
  });

  it("every known error code has a mapped message", () => {
    const knownCodes = ["no_code", "invalid_state", "config", "token_exchange", "user_fetch"];
    for (const code of knownCodes) {
      expect(OAUTH_ERROR_CODES).toContain(code);
      expect(getOAuthErrorMessage(code, enT)).toBeTruthy();
    }
  });

  it("messages are non-technical and user-friendly", () => {
    const knownCodes = ["no_code", "invalid_state", "config", "token_exchange", "user_fetch"];
    for (const code of knownCodes) {
      const msg = getOAuthErrorMessage(code, enT)!;
      // Messages should not expose internal error codes
      expect(msg).not.toMatch(/code|state|token|config|fetch/i);
      // Messages should be reasonably short
      expect(msg.length).toBeLessThan(200);
      expect(msg.length).toBeGreaterThan(10);
    }
  });

  // #1107 (UX-H1) — the GitHub callback route
  // (app/api/auth/callback/route.ts:158) has redirected to
  // `/?error=session_storage` since it was added, but the code was never
  // registered here, so it silently fell through to the generic fallback
  // message instead of its own copy.
  describe("'session_storage' code", () => {
    it("is a known OAUTH_ERROR_CODES entry", () => {
      expect(OAUTH_ERROR_CODES).toContain("session_storage");
    });

    it("returns a user-friendly, non-technical message", () => {
      const result = getOAuthErrorMessage("session_storage", enT);
      expect(result).toBeTruthy();
      expect(result).not.toContain("session_storage");
    });
  });

  // #1107 (UX-H1) — platform OAuth (Bitbucket/Codeberg/GitLab) connect and
  // callback failures redirect to the user's own share page as
  // `?error=<platform>_<suffix>` (lib/auth/platform-oauth.ts). These codes
  // are never a bare OAUTH_ERROR_CODES member, so getOAuthErrorMessage must
  // recognize the `<platform>_<suffix>` shape and return copy that names the
  // platform rather than generic GitHub sign-in wording.
  describe("platform OAuth error codes", () => {
    const platforms = ["bitbucket", "codeberg", "gitlab"] as const;
    const suffixes = [
      "no_code",
      "invalid_state",
      "config",
      "token_exchange",
      "user_fetch",
      "storage",
    ] as const;

    for (const platform of platforms) {
      for (const suffix of suffixes) {
        it(`returns a truthy message for '${platform}_${suffix}'`, () => {
          const result = getOAuthErrorMessage(`${platform}_${suffix}`, enT);
          expect(result).toBeTruthy();
          expect(typeof result).toBe("string");
        });
      }
    }

    it("names the platform for connection failures instead of using generic GitHub wording", () => {
      expect(getOAuthErrorMessage("gitlab_token_exchange", enT)).toContain("GitLab");
      expect(getOAuthErrorMessage("bitbucket_token_exchange", enT)).toContain("Bitbucket");
      expect(getOAuthErrorMessage("codeberg_token_exchange", enT)).toContain("Codeberg");
    });

    it("does not fall back to GitHub sign-in copy for a platform failure", () => {
      const msg = getOAuthErrorMessage("gitlab_token_exchange", enT)!;
      expect(msg).not.toContain("GitHub");
      expect(msg).not.toContain("sign-in");
    });

    it("distinguishes platform connect failures from each other by platform name", () => {
      const gitlab = getOAuthErrorMessage("gitlab_user_fetch", enT)!;
      const bitbucket = getOAuthErrorMessage("bitbucket_user_fetch", enT)!;
      expect(gitlab).not.toBe(bitbucket);
    });
  });

  // #1109 (UX-H3): OAuth error messages must render in the visitor's locale,
  // not a hardcoded English literal.
  describe("i18n (#1109)", () => {
    // #1164: `t` is now a required parameter (no more implicit English
    // default) — this test now asserts the explicit-translator contract
    // rather than an implicit fallback.
    it("resolves the English message when given an explicit English translator", () => {
      expect(getOAuthErrorMessage("no_code", enT)).toBe(
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
        expect(msg).not.toBe(getOAuthErrorMessage(code, enT));
      }
    });

    it("resolves the Spanish fallback for an unknown code", () => {
      const esT = (key: string) => resolveTranslation(key, es) as string;
      const msg = getOAuthErrorMessage("unknown_error_xyz", esT);
      expect(msg).toBe(resolveTranslation("oauthErrors.fallback", es));
    });

    it("resolves platform-aware messages in Spanish, naming the platform", () => {
      const esT = (key: string) => resolveTranslation(key, es) as string;
      const msg = esT ? getOAuthErrorMessage("gitlab_token_exchange", esT) : null;
      expect(msg).toBeTruthy();
      expect(msg).toContain("GitLab");
      expect(msg).not.toBe(getOAuthErrorMessage("gitlab_token_exchange", enT));
    });
  });
});
