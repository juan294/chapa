import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import { fetchCodebergStats } from "./stats";
import type { StatsData } from "@chapa/shared";

/** Legacy scalar adapter; current linkage and CAS refresh belong to the shared boundary. */
export async function fetchCodebergIfLinked(handle: string, lowerHandle: string, options: { readOnly?: boolean } = {}): Promise<StatsData | null> {
  if (handle.toLowerCase() !== lowerHandle.toLowerCase()) return null;
  return fetchLinkedPlatformStats({ platform: "codeberg", lowerHandle, readOnly: options.readOnly,
    fetchStats: (linked, accessToken) => fetchCodebergStats(linked.remoteLogin, accessToken, { displayName: linked.remoteLogin, avatarUrl: "" }) });
}
