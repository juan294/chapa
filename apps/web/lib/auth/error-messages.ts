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
  // #1107 \u2014 emitted by app/api/auth/callback/route.ts:158 since it was
  // added, but never registered here; it silently fell through to the
  // generic FALLBACK_MESSAGE instead of getting its own copy.
  "session_storage",
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
  session_storage:
    "We couldn\u2019t start your session. Please try again.",
};

const FALLBACK_MESSAGE = "Something went wrong during sign-in. Please try again.";

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

const PLATFORM_SUFFIX_MESSAGES: Record<
  PlatformOAuthSuffix,
  (platform: string) => string
> = {
  no_code: (platform) =>
    `Connecting your ${platform} account was interrupted before completing. Please try again.`,
  invalid_state: (platform) =>
    `Your ${platform} connection request expired or was invalid. Please try again.`,
  config: () => "Something went wrong on our end. Please try again later.",
  token_exchange: (platform) =>
    `We couldn\u2019t connect your ${platform} account. Please try again.`,
  user_fetch: (platform) =>
    `We couldn\u2019t retrieve your ${platform} profile. Please try again.`,
  storage: (platform) =>
    `We couldn\u2019t save your ${platform} connection. Please try again.`,
};

/**
 * Matches a `<platform>_<suffix>` code and builds platform-aware copy, or
 * returns `null` when `code` isn't one of the recognized platform codes.
 */
function getPlatformOAuthErrorMessage(code: string): string | null {
  for (const platform of PLATFORM_OAUTH_PLATFORMS) {
    const prefix = `${platform}_`;
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length) as PlatformOAuthSuffix;
    const buildMessage = PLATFORM_SUFFIX_MESSAGES[suffix];
    return buildMessage ? buildMessage(PLATFORM_LABELS[platform]) : null;
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
 */
export function getOAuthErrorMessage(
  code: string | null | undefined,
): string | null {
  if (!code) return null;

  const platformMessage = getPlatformOAuthErrorMessage(code);
  if (platformMessage) return platformMessage;

  const known = ERROR_MESSAGES[code as OAuthErrorCode];
  return known ?? FALLBACK_MESSAGE;
}
