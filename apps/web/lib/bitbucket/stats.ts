import { fetchBitbucketContributionData } from "./queries";
import { buildStatsFromBitbucket } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Fetch and transform Bitbucket data into StatsData */
export async function fetchBitbucketStats(
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchBitbucketContributionData(username, accessToken, profile);
  if (!raw) return null;
  return buildStatsFromBitbucket(raw);
}
