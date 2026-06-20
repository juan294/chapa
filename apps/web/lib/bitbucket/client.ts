import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { getBitbucketClientId, getBitbucketClientSecret } from "@/lib/env";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired, refreshBitbucketToken } from "@/lib/auth/bitbucket";
import { fetchBitbucketStats } from "./stats";
import type { StatsData } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours
const NEG_CACHE_TTL = 3600; // 1h — short-circuit "not linked/disabled" on next request

/** Fetch Bitbucket stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchBitbucketIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const bbCacheKey = `stats:v2:bitbucket:${lowerHandle}`;
  const negKey = `${bbCacheKey}:neg`;

  const cached = await cacheGet<StatsData>(bbCacheKey);
  if (cached) return cached;

  const neg = await cacheGet<boolean>(negKey);
  if (neg) return null;

  const enabled = await isBitbucketEnabled();
  if (!enabled) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  const linked = await dbGetLinkedPlatform(handle, "bitbucket");
  if (!linked) {
    void cacheSet(negKey, true, NEG_CACHE_TTL);
    return null;
  }

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      void dbDeleteLinkedPlatform(handle, "bitbucket");
      return null;
    }

    const clientId = getBitbucketClientId() ?? "";
    const clientSecret = getBitbucketClientSecret() ?? "";
    const result = await refreshBitbucketToken(refreshToken, clientId, clientSecret);

    if (!result.ok) {
      if (result.reason === "revoked") {
        void dbDeleteLinkedPlatform(handle, "bitbucket");
      }
      return null;
    }

    accessToken = result.tokens.access_token;
    void dbUpdatePlatformTokens(
      handle,
      "bitbucket",
      result.tokens.access_token,
      result.tokens.refresh_token,
      new Date(Date.now() + result.tokens.expires_in * 1000),
    );
  }

  const bbStats = await fetchBitbucketStats(
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (bbStats) {
    await cacheSet(bbCacheKey, bbStats, CACHE_TTL);
  }

  return bbStats;
}
