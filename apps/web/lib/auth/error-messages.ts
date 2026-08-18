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
 * (`useTranslation()`'s `t`, or `getServerT`). The default `t` — matching
 * `useTranslation()`'s no-provider fallback — resolves against the English
 * dictionary, so existing callers that don't pass a translator keep working
 * unchanged.
 */
import { en } from "@/lib/i18n/dictionaries/en";
import { resolveTranslation } from "@/lib/i18n/resolve";

export const OAUTH_ERROR_CODES = [
  "no_code",
  "invalid_state",
  "config",
  "token_exchange",
  "user_fetch",
] as const;

type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

const ERROR_MESSAGE_KEYS: Record<OAuthErrorCode, string> = {
  no_code: "oauthErrors.noCode",
  invalid_state: "oauthErrors.invalidState",
  config: "oauthErrors.config",
  token_exchange: "oauthErrors.tokenExchange",
  user_fetch: "oauthErrors.userFetch",
};

const FALLBACK_KEY = "oauthErrors.fallback";

function defaultT(key: string): string {
  return resolveTranslation(key, en) as string;
}

/**
 * Maps an OAuth error code (from the URL `?error=` param) to a
 * user-friendly message string.
 *
 * Returns `null` when the input is falsy (undefined, null, empty string),
 * meaning there is no error to display.
 *
 * @param t Optional translator, e.g. `useTranslation().t`. Defaults to the
 *   English dictionary when omitted.
 */
export function getOAuthErrorMessage(
  code: string | null | undefined,
  t: (key: string) => string = defaultT,
): string | null {
  if (!code) return null;

  const key = ERROR_MESSAGE_KEYS[code as OAuthErrorCode] ?? FALLBACK_KEY;
  return t(key);
}
