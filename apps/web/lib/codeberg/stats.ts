import { fetchCodebergContributionData } from "./queries";
import { buildStatsFromCodeberg } from "./stats-aggregation";
import type { StatsData } from "@chapa/shared";

/** @public Compatibility export for v7 evidence consumers. */
export { fetchCodebergEvidence } from "./evidence";
/** @public Compatibility types for v7 evidence consumers. */
export type { CodebergEvidenceOptions, CodebergEvidenceProgress, CodebergEvidenceResult } from "./evidence";
/** @public Checkpointed, resumable collector slice API (#1335 phase 3). */
export { collectCodebergSlice } from "./evidence";

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
