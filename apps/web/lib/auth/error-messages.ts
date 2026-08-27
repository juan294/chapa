/**
 * OAuth error code → user-friendly message mapping.
 *
 * These codes are set by the callback route (`/api/auth/callback`)
 * and passed to the landing page as `?error=<code>`.
 *
 * Messages must be non-technical and never expose internal details.
 *
 * Message text lives in the i18n dictionary (`oauthErrors.*`, #1109) so it
 * renders in the visitor's locale. This module stays a pure, dependency-free
 * code→dictKey lookup; callers resolve the key through their own translator
 * (`useTranslation()`'s `t`, or `getServerT`).
 *
 * #1164 (FE-H1/PE-H1): `t` has no default translator. It previously defaulted
 * to a `defaultT` that statically imported the English dictionary, which
 * pulled that dictionary into every client bundle reachable from this
 * module's callers regardless of locale — but every real call site
 * (`app/u/[handle]/page.tsx`, `app/LandingUrlEffects.tsx`) already passes its
 * own translator, so the default was dead in the client path. Callers must
 * now always pass `t`.
 */
import { interpolate } from "@/lib/i18n/interpolate";

export const OAUTH_ERROR_CODES = [
  "no_code",
  "invalid_state",
  "config",
  "token_exchange",
  "user_fetch",
  // #1107 \u2014 emitted by app/api/auth/callback/route.ts:158 since it was
  // added, but never registered here; it silently fell through to the
  // generic fallback message instead of getting its own copy.
  "session_storage",
] as const;

type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

const ERROR_MESSAGE_KEYS: Record<OAuthErrorCode, string> = {
  no_code: "oauthErrors.noCode",
  invalid_state: "oauthErrors.invalidState",
  config: "oauthErrors.config",
  token_exchange: "oauthErrors.tokenExchange",
  user_fetch: "oauthErrors.userFetch",
  session_storage: "oauthErrors.sessionStorage",
};

const FALLBACK_KEY = "oauthErrors.fallback";

/**
 * Platform identifiers used by the linked-account OAuth flows
 * (`lib/auth/platform-oauth.ts`). Every Bitbucket/Codeberg/GitLab connect and
 * callback failure branch redirects back to the user's own share page as
 * `?error=<platform>_<suffix>` (#1107 / UX-H1) \u2014 a shape the base
 * `OAUTH_ERROR_CODES` above never covers.
 */
const PLATFORM_OAUTH_PLATFORMS = ["bitbucket", "codeberg", "gitlab"] as const;
type PlatformOAuthPlatform = (typeof PLATFORM_OAUTH_PLATFORMS)[number];

const PLATFORM_LABELS: Record<PlatformOAuthPlatform, string> = {
  bitbucket: "Bitbucket",
  codeberg: "Codeberg",
  gitlab: "GitLab",
};

type PlatformOAuthSuffix =
  | "no_code"
  | "invalid_state"
  | "config"
  | "token_exchange"
  | "user_fetch"
  | "storage";

const PLATFORM_SUFFIX_KEYS: Record<PlatformOAuthSuffix, string> = {
  no_code: "oauthErrors.platform.noCode",
  invalid_state: "oauthErrors.platform.invalidState",
  config: "oauthErrors.platform.config",
  token_exchange: "oauthErrors.platform.tokenExchange",
  user_fetch: "oauthErrors.platform.userFetch",
  storage: "oauthErrors.platform.storage",
};

/**
 * Matches a `<platform>_<suffix>` code and builds platform-aware, translated
 * copy, or returns `null` when `code` isn't one of the recognized platform
 * codes. Dictionary strings carry a `{platform}` placeholder (#1109) resolved
 * via `interpolate()` \u2014 the same pattern used elsewhere in the i18n system
 * (see `ScoreExplanationPanel.tsx`'s `platformLine`/`qualityCaveat`).
 */
function getPlatformOAuthErrorMessage(
  code: string,
  t: (key: string) => string,
): string | null {
  for (const platform of PLATFORM_OAUTH_PLATFORMS) {
    const prefix = `${platform}_`;
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length) as PlatformOAuthSuffix;
    const key = PLATFORM_SUFFIX_KEYS[suffix];
    if (!key) return null;
    return interpolate(t(key), { platform: PLATFORM_LABELS[platform] });
  }
  return null;
}

/**
 * Maps an OAuth error code (from the URL `?error=` param) to a
 * user-friendly message string. Recognizes both the base GitHub sign-in
 * codes and the platform-prefixed `<platform>_<suffix>` codes emitted by the
 * Bitbucket/Codeberg/GitLab linked-account flows (#1107).
 *
 * Returns `null` when the input is falsy (undefined, null, empty string),
 * meaning there is no error to display.
 *
 * @param t Translator, e.g. `useTranslation().t` or `getServerT(locale)`.
 */
export function getOAuthErrorMessage(
  code: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!code) return null;

  const platformMessage = getPlatformOAuthErrorMessage(code, t);
  if (platformMessage) return platformMessage;

  const key = ERROR_MESSAGE_KEYS[code as OAuthErrorCode] ?? FALLBACK_KEY;
  return t(key);
}
