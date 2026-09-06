import "server-only";
import { withTimeout } from "@/lib/async/with-timeout";
import type { StatsData } from "@chapa/shared";
import type { StrictLinkedPlatform } from "@/lib/db/user-platforms";
import { readSourceAuthorization, sameSourceAuthorization, type SourceProvider } from "./source-authorization";
import { refreshSourceLink } from "./source-refresh";
export const PLATFORM_FETCH_DEADLINE_MS = 8_000;
export type LinkedPlatformRecord = StrictLinkedPlatform;
export interface FetchLinkedPlatformConfig {
  platform: Exclude<SourceProvider, "github">;
  lowerHandle: string;
  readOnly?: boolean;
  fetchStats: (linked: LinkedPlatformRecord, accessToken: string) => Promise<StatsData | null>;
}
/** Uncached v6 compatibility. No unbound positive/negative cache can bypass
 * present flags/linkage, and a read-only caller cannot start refresh or HTTP.
 */
export async function fetchLinkedPlatformStats(config: FetchLinkedPlatformConfig): Promise<StatsData | null> {
  if (config.readOnly) return null;
  try {
    const owner = config.lowerHandle.toLowerCase();
    const before = await readSourceAuthorization(owner, config.platform, false);
    if (before.status !== "authorized") return null;
    const ready = await refreshSourceLink(before, { owner, provider: config.platform }, false);
    if (ready.status !== "authorized" || !ready.link) return null;
    if (!sameSourceAuthorization(ready, await readSourceAuthorization(owner, config.platform, false))) return null;
    const stats = await withTimeout(config.fetchStats(ready.link, ready.link.tokens.accessToken.trim()), PLATFORM_FETCH_DEADLINE_MS, "Linked source collection").catch(() => null);
    if (!sameSourceAuthorization(ready, await readSourceAuthorization(owner, config.platform, false))) return null;
    return stats ? structuredClone(stats) : null;
  } catch { return null; }
}
