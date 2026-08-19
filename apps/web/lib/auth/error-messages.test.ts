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
      const result = getOAuthErrorMessage("session_storage");
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
          const result = getOAuthErrorMessage(`${platform}_${suffix}`);
          expect(result).toBeTruthy();
          expect(typeof result).toBe("string");
        });
      }
    }

    it("names the platform for connection failures instead of using generic GitHub wording", () => {
      expect(getOAuthErrorMessage("gitlab_token_exchange")).toContain("GitLab");
      expect(getOAuthErrorMessage("bitbucket_token_exchange")).toContain("Bitbucket");
      expect(getOAuthErrorMessage("codeberg_token_exchange")).toContain("Codeberg");
    });

    it("does not fall back to GitHub sign-in copy for a platform failure", () => {
      const msg = getOAuthErrorMessage("gitlab_token_exchange")!;
      expect(msg).not.toContain("GitHub");
      expect(msg).not.toContain("sign-in");
    });

    it("distinguishes platform connect failures from each other by platform name", () => {
      const gitlab = getOAuthErrorMessage("gitlab_user_fetch")!;
      const bitbucket = getOAuthErrorMessage("bitbucket_user_fetch")!;
      expect(gitlab).not.toBe(bitbucket);
    });
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

    it("resolves platform-aware messages in Spanish, naming the platform", () => {
      const esT = (key: string) => resolveTranslation(key, es) as string;
      const msg = esT ? getOAuthErrorMessage("gitlab_token_exchange", esT) : null;
      expect(msg).toBeTruthy();
      expect(msg).toContain("GitLab");
      expect(msg).not.toBe(getOAuthErrorMessage("gitlab_token_exchange"));
    });
  });
});
