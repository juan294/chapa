import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** User profile info passed from the OAuth token store */
interface UserProfile {
  displayName: string;
  avatarUrl: string;
}

/** Fetch and transform Codeberg data into StatsData */
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
