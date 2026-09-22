import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import { fetchBitbucketStats } from "./stats";
import type { StatsData } from "@chapa/shared";

/** Legacy scalar adapter; current linkage and CAS refresh belong to the shared boundary. */
export async function fetchBitbucketIfLinked(handle: string, lowerHandle: string, options: { readOnly?: boolean } = {}): Promise<StatsData | null> {
  if (handle.toLowerCase() !== lowerHandle.toLowerCase()) return null;
  return fetchLinkedPlatformStats({ platform: "bitbucket", lowerHandle, readOnly: options.readOnly,
    fetchStats: (linked, accessToken) => fetchBitbucketStats(linked.remoteLogin, accessToken, { displayName: linked.remoteLogin, avatarUrl: "" }) });
}
