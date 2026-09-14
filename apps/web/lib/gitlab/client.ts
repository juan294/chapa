import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import { fetchGitlabStats } from "./stats";
import type { StatsData } from "@chapa/shared";
import { fetchGitlabUser } from "@/lib/auth/gitlab";

/** Legacy scalar adapter; current linkage and CAS refresh belong to the shared boundary. */
export async function fetchGitlabIfLinked(handle: string, lowerHandle: string, options: { readOnly?: boolean } = {}): Promise<StatsData | null> {
  if (handle.toLowerCase() !== lowerHandle.toLowerCase()) return null;
  return fetchLinkedPlatformStats({ platform: "gitlab", lowerHandle, readOnly: options.readOnly,
    fetchStats: async (linked, accessToken) => {
      const user = await fetchGitlabUser(accessToken);
      if (!user || user.login !== linked.remoteLogin) return null;
      return fetchGitlabStats(user.id, linked.remoteLogin, accessToken, { displayName: linked.remoteLogin, avatarUrl: "" });
    } });
}
