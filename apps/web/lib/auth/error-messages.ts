/**
 * OAuth error code → user-friendly message mapping.
 *
 * These codes are set by the callback route (`/api/auth/callback`)
 * and passed to the landing page as `?error=<code>`.
 *
 * Messages must be non-technical and never expose internal details.
 */

export const OAUTH_ERROR_CODES = [
  "no_code",
  "invalid_state",
  "config",
  "token_exchange",
  "user_fetch",
] as const;

type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

const ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  no_code:
    "Sign-in was interrupted before completing. Please try again.",
  invalid_state:
    "Your sign-in session expired or was invalid. Please try again.",
  config:
    "Something went wrong on our end. Please try again later.",
  token_exchange:
    "We couldn\u2019t complete sign-in with GitHub. Please try again.",
  user_fetch:
    "We couldn\u2019t retrieve your GitHub profile. Please try again.",
};

const FALLBACK_MESSAGE = "Something went wrong during sign-in. Please try again.";

/**
 * Maps an OAuth error code (from the URL `?error=` param) to a
 * user-friendly message string.
 *
 * Returns `null` when the input is falsy (undefined, null, empty string),
 * meaning there is no error to display.
 */
export function getOAuthErrorMessage(
  code: string | null | undefined,
): string | null {
  if (!code) return null;

  const known = ERROR_MESSAGES[code as OAuthErrorCode];
  return known ?? FALLBACK_MESSAGE;
}
