import "server-only";
import { claimPlatformTokenRefresh, finishPlatformTokenRefresh, releasePlatformTokenRefreshAttempt, takeoverPlatformTokenRefresh, markPlatformNeedsReconnect } from "@/lib/db/platform-token-refresh";
import { databaseInstantMicros } from "@/lib/db/source-time";
import { isTokenExpired, refreshBitbucketToken } from "@/lib/auth/bitbucket";
import { refreshGitlabToken } from "@/lib/auth/gitlab";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import { getBitbucketClientId, getBitbucketClientSecret, getGitlabClientId, getGitlabClientSecret, getCodebergClientId, getCodebergClientSecret } from "@/lib/env";
import { readSourceAuthorization, sameSourceAuthorization, type SourceAuthorization, type SourceProvider } from "./source-authorization";

/** An unresolved *ambiguous* durable claim blocks this connection across
 * processes and ordinary version changes. Never unlink automatically or
 * replay an uncertain provider outcome a second time; the only relief for a
 * genuinely ambiguous attempt is one bounded takeover retry (#1332) once it
 * is provably older than any claiming function could still be running, or an
 * explicit disconnect/reconnect. A *definite* outcome (no request sent, or a
 * definitive provider response without new tokens) is released in the same
 * call instead of left blocking forever — see `releaseNonAmbiguous` below.
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

    // Claim, or attempt exactly one bounded takeover of a stale ambiguous
    // claim. `takeoverPlatformTokenRefresh` re-checks staleness under its own
    // row lock, so calling it whenever the first claim comes back "busy" is
    // always safe: it is a no-op (returns "too_fresh"/"exhausted") when this
    // is not the moment for a takeover.
    const claim = await claimPlatformTokenRefresh(link);
    let attemptId: string;
    let isTakeover: boolean;
    if (claim.status === "claimed") {
      attemptId = claim.attemptId; isTakeover = false;
    } else if (claim.status === "busy") {
      const takeover = await takeoverPlatformTokenRefresh(link);
      if (takeover.status !== "claimed") return { status: "unavailable" };
      attemptId = takeover.attemptId; isTakeover = true;
    } else {
      return { status: "unavailable" };
    }

    // No provider request sent yet: this is a known, non-ambiguous outcome,
    // so release rather than leave the barrier for nothing (#1332 case 1).
    // Claim storage also checks current consent for legacy callers. A pre-v7
    // connection cannot gain new refresh permission through this compatibility
    // path. Rechecking after the claim may abandon it, but never replays a grant.
    if (!sameSourceAuthorization(initial, await current())) {
      await releasePlatformTokenRefreshAttempt(link, attemptId);
      return { status: "unavailable" };
    }

    const result = await refresh(link.tokens.refreshToken, clientId, secret);

    if (!sameSourceAuthorization(initial, await current())) {
      // Linkage changed while a request was outstanding. If the provider
      // definitely did or did not act (success or a definitive failure), that
      // is known and the barrier can be released; a genuinely ambiguous
      // result must still be left in place, since the outcome remains unknown.
      if (result.ok || result.outcome === "definitive") {
        await releasePlatformTokenRefreshAttempt(link, attemptId, result.ok ? false : result.reason === "revoked");
      }
      return { status: "unavailable" };
    }

    if (!result.ok) {
      if (result.outcome === "definitive") {
        // #1332 case 2: the provider gave a definitive answer without new
        // tokens. Release in the same call; only a revoke also asks the
        // owner to reconnect.
        await releasePlatformTokenRefreshAttempt(link, attemptId, result.reason === "revoked");
      } else if (isTakeover) {
        // The one allowed takeover retry was itself ambiguous. No further
        // takeover is possible (the row is now permanently exhausted), so
        // waiting longer can never resolve this — surface it to the owner
        // without releasing the still-genuinely-unknown barrier.
        await markPlatformNeedsReconnect(link);
      }
      // A first-ever ambiguous outcome (not a takeover): keep the barrier
      // exactly as before, do nothing further.
      return { status: "unavailable" };
    }

    const committed = await finishPlatformTokenRefresh(link, attemptId, { accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token ?? link.tokens.refreshToken,
      expiresAt: result.tokens.expires_in ? new Date(Date.now() + result.tokens.expires_in * 1000) : null });
    if (committed.status !== "updated") return { status: "unavailable" };
    const after = await current();
    if (after.status !== "authorized" || after.consentVersion !== initial.consentVersion || after.link?.id !== committed.id || databaseInstantMicros(after.link.updatedAt) !== databaseInstantMicros(committed.updatedAt) || after.link.tokens.accessToken !== result.tokens.access_token) return { status: "unavailable" };
    return after;
  } catch { return { status: "unavailable" }; }
}
