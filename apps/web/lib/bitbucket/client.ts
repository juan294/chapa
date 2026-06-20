import { isBitbucketEnabled } from "@/lib/feature-flags";
import { getBitbucketClientId, getBitbucketClientSecret } from "@/lib/env";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired, refreshBitbucketToken } from "@/lib/auth/bitbucket";
import {
  fetchLinkedPlatformStats,
  type LinkedPlatformRecord,
} from "@/lib/platform/fetch-linked-platform";
import { fetchBitbucketStats } from "./stats";
import type { StatsData } from "@chapa/shared";

/**
 * Resolve a usable Bitbucket access token, refreshing if expired.
 * Returns null (short-circuit, no fetch) when the grant can't be recovered.
 */
async function resolveBitbucketToken(
  handle: string,
  linked: LinkedPlatformRecord,
): Promise<string | null> {
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

  return accessToken;
}

/** Fetch Bitbucket stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchBitbucketIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  return fetchLinkedPlatformStats({
    platform: "bitbucket",
    lowerHandle,
    isEnabled: isBitbucketEnabled,
    getLinkedPlatform: () => dbGetLinkedPlatform(handle, "bitbucket"),
    resolveAccessToken: (linked) => resolveBitbucketToken(handle, linked),
    fetchStats: (linked, accessToken) =>
      fetchBitbucketStats(linked.remoteLogin, accessToken, {
        displayName: linked.remoteLogin,
        avatarUrl: "",
      }),
  });
}
