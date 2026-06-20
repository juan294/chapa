import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { isGitlabEnabled } from "@/lib/feature-flags";
import { getGitlabClientId, getGitlabClientSecret } from "@/lib/env";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired } from "@/lib/auth/bitbucket";
import { refreshGitlabToken, fetchGitlabUser } from "@/lib/auth/gitlab";
import { fetchGitlabStats } from "./stats";
import type { StatsData } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours
const NEG_CACHE_TTL = 3600; // 1h — short-circuit "not linked/disabled" on next request

/** Fetch GitLab stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchGitlabIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const glCacheKey = `stats:v2:gitlab:${lowerHandle}`;
  const negKey = `${glCacheKey}:neg`;

  const cached = await cacheGet<StatsData>(glCacheKey);
  if (cached) return cached;

  const neg = await cacheGet<boolean>(negKey);
  if (neg) return null;

  const enabled = await isGitlabEnabled();
  if (!enabled) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  const linked = await dbGetLinkedPlatform(handle, "gitlab");
  if (!linked) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      // No refresh token and token expired — can't recover.
      // If expiresAt is null, token may be long-lived — try anyway.
      if (expiresAt !== null) {
        void dbDeleteLinkedPlatform(handle, "gitlab");
        return null;
      }
    } else {
      const clientId = getGitlabClientId();
      const clientSecret = getGitlabClientSecret();

      // BE-L3 (#888): short-circuit when OAuth app credentials are not configured.
      // Attempting refresh with empty strings wastes a round-trip and returns a
      // confusing upstream error. Return null clearly without calling upstream.
      if (!clientId || !clientSecret) {
        return null;
      }

      const result = await refreshGitlabToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      if (!result.ok) {
        if (result.reason === "revoked") {
          void dbDeleteLinkedPlatform(handle, "gitlab");
        }
        return null;
      }

      accessToken = result.tokens.access_token;
      void dbUpdatePlatformTokens(
        handle,
        "gitlab",
        result.tokens.access_token,
        result.tokens.refresh_token ?? null,
        result.tokens.expires_in
          ? new Date(Date.now() + result.tokens.expires_in * 1000)
          : null,
      );
    }
  }

  // GitLab's events/projects endpoints key on the numeric user id, which is not
  // stored in user_platforms (only the login). Resolve it from the token; this
  // is the one GitLab-specific deviation from the Codeberg client shape.
  const user = await fetchGitlabUser(accessToken);
  if (!user) return null;

  const glStats = await fetchGitlabStats(
    user.id,
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (glStats) {
    await cacheSet(glCacheKey, glStats, CACHE_TTL);
  }

  return glStats;
}
