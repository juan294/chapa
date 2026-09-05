import { fetchGitlabContributionData } from "./queries";
import { buildStatsFromGitlab } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

export { fetchGitlabEvidence } from "./evidence";
export type { GitlabEvidenceOptions, GitlabEvidenceProgress, GitlabEvidenceResult } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use fetchGitlabEvidence. */
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
