import { isGitlabEnabled } from "@/lib/feature-flags";
import { getGitlabClientId, getGitlabClientSecret } from "@/lib/env";
import {
  dbGetLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
} from "@/lib/db/user-platforms";
import { isTokenExpired } from "@/lib/auth/bitbucket";
import { refreshGitlabToken, fetchGitlabUser } from "@/lib/auth/gitlab";
import {
  fetchLinkedPlatformStats,
  type LinkedPlatformRecord,
} from "@/lib/platform/fetch-linked-platform";
import { fetchGitlabStats } from "./stats";
import type { StatsData } from "@chapa/shared";

/**
 * Resolve a usable GitLab access token, refreshing if expired.
 * Returns null (short-circuit, no fetch) when the grant can't be recovered or
 * when OAuth app credentials are not configured (BE-L3 / #888).
 */
async function resolveGitlabToken(
  handle: string,
  linked: LinkedPlatformRecord,
): Promise<string | null> {
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

  return accessToken;
}

/** Fetch GitLab stats from cache or live API. Returns null if not linked/disabled. */
export async function fetchGitlabIfLinked(
  handle: string,
  lowerHandle: string,
): Promise<StatsData | null> {
  return fetchLinkedPlatformStats({
    platform: "gitlab",
    lowerHandle,
    isEnabled: isGitlabEnabled,
    getLinkedPlatform: () => dbGetLinkedPlatform(handle, "gitlab"),
    resolveAccessToken: (linked) => resolveGitlabToken(handle, linked),
    fetchStats: async (linked, accessToken) => {
      // GitLab's events/projects endpoints key on the numeric user id, which is
      // not stored in user_platforms (only the login). Resolve it from the
      // token; this is the one GitLab-specific deviation from the Codeberg
      // client shape.
      const user = await fetchGitlabUser(accessToken);
      if (!user) return null;

      return fetchGitlabStats(user.id, linked.remoteLogin, accessToken, {
        displayName: linked.remoteLogin,
        avatarUrl: "",
      });
    },
  });
}
