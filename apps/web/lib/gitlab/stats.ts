import { fetchGitlabContributionData } from "./queries";
import { buildStatsFromGitlab } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Fetch and transform GitLab data into StatsData */
export async function fetchGitlabStats(
  userId: number,
  username: string,
  accessToken: string,
  profile: UserProfile,
): Promise<StatsData | null> {
  const raw = await fetchGitlabContributionData(
    userId,
    username,
    accessToken,
    profile,
  );
  if (!raw) return null;
  return buildStatsFromGitlab(raw);
}
