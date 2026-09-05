import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

export { fetchCodebergEvidence } from "./evidence";
export type { CodebergEvidenceOptions, CodebergEvidenceProgress, CodebergEvidenceResult } from "./evidence";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Legacy v6 scalar reader. v7 consumers must use fetchCodebergEvidence. */
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
