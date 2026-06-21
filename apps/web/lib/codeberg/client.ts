import { isCodebergEnabled } from "@/lib/feature-flags";
import { getCodebergClientId, getCodebergClientSecret } from "@/lib/env";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired } from "@/lib/auth/bitbucket";
import { refreshCodebergToken } from "@/lib/auth/codeberg";
import {
  fetchLinkedPlatformStats,
  type LinkedPlatformRecord,
} from "@/lib/platform/fetch-linked-platform";
import { fetchCodebergStats } from "./stats";
import type { StatsData } from "@chapa/shared";

/**
 * Resolve a usable Codeberg access token, refreshing if expired.
 * Codeberg supports long-lived tokens with a null `expiresAt` — in that case we
 * proceed with the current token rather than unlinking. Returns null
 * (short-circuit, no fetch) when the grant can't be recovered.
 */
async function resolveCodebergToken(
  handle: string,
  linked: LinkedPlatformRecord,
): Promise<string | null> {
  let { accessToken } = linked.tokens;
  const { refreshToken, expiresAt } = linked.tokens;

  if (isTokenExpired(expiresAt)) {
    if (!refreshToken) {
      // No refresh token and token expired — can't recover
      // If expiresAt is null, token may be long-lived — try anyway
      if (expiresAt !== null) {
        await dbDeleteLinkedPlatform(handle, "codeberg");
        return null;
      }
      // expiresAt is null → long-lived token, proceed with current token
    } else {
      const clientId = getCodebergClientId() ?? "";
      const clientSecret = getCodebergClientSecret() ?? "";
      const result = await refreshCodebergToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      if (!result.ok) {
        if (result.reason === "revoked") {
          await dbDeleteLinkedPlatform(handle, "codeberg");
        }
        return null;
      }

      accessToken = result.tokens.access_token;
      await dbUpdatePlatformTokens(
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

  return accessToken;
}

/** Fetch Codeberg stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchCodebergIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  return fetchLinkedPlatformStats({
    platform: "codeberg",
    lowerHandle,
    isEnabled: isCodebergEnabled,
    getLinkedPlatform: () => dbGetLinkedPlatform(handle, "codeberg"),
    resolveAccessToken: (linked) => resolveCodebergToken(handle, linked),
    fetchStats: (linked, accessToken) =>
      fetchCodebergStats(linked.remoteLogin, accessToken, {
        displayName: linked.remoteLogin,
        avatarUrl: "",
      }),
  });
}
