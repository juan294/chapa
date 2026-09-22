import "server-only";
import { claimPlatformTokenRefresh, finishPlatformTokenRefresh } from "@/lib/db/platform-token-refresh";
import { databaseInstantMicros } from "@/lib/db/source-time";
import { isTokenExpired, refreshBitbucketToken } from "@/lib/auth/bitbucket";
import { refreshGitlabToken } from "@/lib/auth/gitlab";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import { getBitbucketClientId, getBitbucketClientSecret, getGitlabClientId, getGitlabClientSecret, getCodebergClientId, getCodebergClientSecret } from "@/lib/env";
import { readSourceAuthorization, sameSourceAuthorization, type SourceAuthorization, type SourceProvider } from "./source-authorization";

/** An unresolved durable claim blocks this connection across processes and
 * ordinary version changes. Never unlink automatically or retry uncertain
 * provider outcomes; recovery requires an explicit disconnect/reconnect.
 */
export async function refreshSourceLink(initial: Extract<SourceAuthorization, { status: "authorized" }>,
  input: { owner: string; provider: SourceProvider; readOnly?: boolean }, requireConsent = true,
): Promise<SourceAuthorization> {
  try {
    const link = initial.link;
    if (!link || input.readOnly || !isTokenExpired(link.tokens.expiresAt)) return initial;
    if (!link.tokens.refreshToken && link.tokens.expiresAt === null && input.provider !== "bitbucket") return initial;
    const current = () => readSourceAuthorization(input.owner, input.provider, requireConsent);
    if (!sameSourceAuthorization(initial, await current())) return { status: "unavailable" };
    if (!link.tokens.refreshToken) return { status: "unavailable" };
    const [clientId, secret, refresh] = input.provider === "bitbucket"
      ? [getBitbucketClientId(), getBitbucketClientSecret(), refreshBitbucketToken] as const
      : input.provider === "codeberg"
        ? [getCodebergClientId(), getCodebergClientSecret(), refreshCodebergToken] as const
        : [getGitlabClientId(), getGitlabClientSecret(), refreshGitlabToken] as const;
    if (!clientId || !secret) return { status: "unavailable" };
    const claim = await claimPlatformTokenRefresh(link);
    if (claim.status !== "claimed") return { status: "unavailable" };
    // Claim storage also checks current consent for legacy callers. A pre-v7
    // connection cannot gain new refresh permission through this compatibility
    // path. Rechecking after the claim may abandon it, but never replays a grant.
    if (!sameSourceAuthorization(initial, await current())) return { status: "unavailable" };
    const result = await refresh(link.tokens.refreshToken, clientId, secret);
    if (!sameSourceAuthorization(initial, await current())) return { status: "unavailable" };
    if (!result.ok) return { status: "unavailable" };
    const committed = await finishPlatformTokenRefresh(link, claim.attemptId, { accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token ?? link.tokens.refreshToken,
      expiresAt: result.tokens.expires_in ? new Date(Date.now() + result.tokens.expires_in * 1000) : null });
    if (committed.status !== "updated") return { status: "unavailable" };
    const after = await current();
    if (after.status !== "authorized" || after.consentVersion !== initial.consentVersion || after.link?.id !== committed.id || databaseInstantMicros(after.link.updatedAt) !== databaseInstantMicros(committed.updatedAt) || after.link.tokens.accessToken !== result.tokens.access_token) return { status: "unavailable" };
    return after;
  } catch { return { status: "unavailable" }; }
}
