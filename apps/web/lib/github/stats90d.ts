import type { Stats90d } from "@chapa/shared";
import { buildStats90dFromRaw } from "@chapa/shared";
import { fetchContributionData } from "./queries";

// ---------------------------------------------------------------------------
// fetchStats90d — main aggregation function
// ---------------------------------------------------------------------------

export async function fetchStats90d(
  handle: string,
  token?: string,
): Promise<Stats90d | null> {
  const raw = await fetchContributionData(handle, token);
  if (!raw) return null;

  return buildStats90dFromRaw(raw);
}
