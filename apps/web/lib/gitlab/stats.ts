import { fetchGitlabContributionData } from "./queries";
import { buildStatsFromGitlab } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** @public Checkpointed, resumable collector slice API (#1335 phase 3) --
 * the only GitLab collection implementation since the single-run
 * `fetchGitlabEvidence` was removed with the durable queue worker's rollout.
 */
export { collectGitlabSlice } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use collectGitlabSlice. */
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
