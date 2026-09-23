import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** @public Checkpointed, resumable collector slice API (#1335 phase 3) --
 * the only Codeberg collection implementation since the single-run
 * `fetchCodebergEvidence` was removed with the durable queue worker's rollout.
 */
export { collectCodebergSlice } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use collectCodebergSlice. */
export async function fetchCodebergStats(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchCodebergContributionData(
    username,
    accessToken,
    profile,
  );
  if (!raw) return null;
  return buildStatsFromCodeberg(raw);
}
