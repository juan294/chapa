import {
  materializeProfile,
  type MaterializedProfile,
} from "./materialize-profile";
import { isGitHubUserNotFound } from "@/lib/github/not-found";

export async function materializeOrchestratedProfile(
  handle: string,
  options: {
    token?: string;
  } = {},
): Promise<MaterializedProfile | null> {
  const materialized = await materializeProfile(handle, {
    token: options.token,
  });
  // LE-8-2 — for the refresh, recalculate and warm-cache writers a handle
  // GitHub does not know is "nothing to persist", exactly as an unavailable
  // fetch is. Only the public read surfaces turn the sentinel into a 404.
  return isGitHubUserNotFound(materialized) ? null : materialized;
}
