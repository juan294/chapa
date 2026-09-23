import { fetchBitbucketContributionData } from "./queries";
import { buildStatsFromBitbucket } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** @public Checkpointed, resumable collector slice API (#1335 phase 3) --
 * the only Bitbucket collection implementation since the single-run
 * `fetchBitbucketEvidence` was removed with the durable queue worker's rollout.
 */
export { collectBitbucketSlice } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use collectBitbucketSlice. */
export async function fetchBitbucketStats(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchBitbucketContributionData(username, accessToken, profile);
  if (!raw) return null;
  return buildStatsFromBitbucket(raw);
}
