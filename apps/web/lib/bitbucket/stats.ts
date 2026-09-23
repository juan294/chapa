import { fetchBitbucketContributionData } from "./queries";
import { buildStatsFromBitbucket } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** @public Compatibility export for v7 evidence consumers. */
export { fetchBitbucketEvidence } from "./evidence";
/** @public Compatibility types for v7 evidence consumers. */
export type { BitbucketEvidenceOptions, BitbucketEvidenceProgress, BitbucketEvidenceResult } from "./evidence";
/** @public Checkpointed, resumable collector slice API (#1335 phase 3). */
export { collectBitbucketSlice } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use fetchBitbucketEvidence. */
export async function fetchBitbucketStats(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchBitbucketContributionData(username, accessToken, profile);
  if (!raw) return null;
  return buildStatsFromBitbucket(raw);
}
