import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { isCodebergEnabled } from "@/lib/feature-flags";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired } from "@/lib/auth/bitbucket";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import { fetchCodebergStats } from "./stats";
import type { StatsData } from "@chapa/shared";

const CACHE_TTL = 21600; // 6 hours

/** Fetch Codeberg stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchCodebergIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  const cbCacheKey = `stats:v2:codeberg:${lowerHandle}`;

  const cached = await cacheGet<StatsData>(cbCacheKey);
  if (cached) return cached;

  const enabled = await isCodebergEnabled();
  if (!enabled) return null;

  const linked = await dbGetLinkedPlatform(handle, "codeberg");
  if (!linked) return null;

  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      // No refresh token and token expired — can't recover
      // If expiresAt is null, token may be long-lived — try anyway
      if (expiresAt !== null) {
        void dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }
      // expiresAt is null → long-lived token, proceed with current token
    } else {
      const clientId = process.env.CODEBERG_CLIENT_ID?.trim() ?? "";
      const clientSecret = process.env.CODEBERG_CLIENT_SECRET?.trim() ?? "";
      const result = await refreshCodebergToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      if (!result.ok) {
        if (result.reason === "revoked") {
          void dbDeleteLinkedPlatform(handle, "codeberg");
        }
        return null;
      }

      accessToken = result.tokens.access_token;
      void dbUpdatePlatformTokens(
        handle,
        "codeberg",
        result.tokens.access_token,
        result.tokens.refresh_token ?? null,
        result.tokens.expires_in
          ? new Date(Date.now() + result.tokens.expires_in * 1000)
          : null,
      );
    }
  }

  const cbStats = await fetchCodebergStats(
    linked.remoteLogin,
    accessToken,
    { displayName: linked.remoteLogin, avatarUrl: "" },
  );

  if (cbStats) {
    await cacheSet(cbCacheKey, cbStats, CACHE_TTL);
  }

  return cbStats;
}
