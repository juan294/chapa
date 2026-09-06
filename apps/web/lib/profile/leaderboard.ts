import "server-only";
import { dbGetScoredCandidates, dbGetTopScoredProfiles } from "@/lib/db/snapshots";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { materializeDisplayProfile } from "./materialize-profile";

export interface LeaderboardEntry {
  handle: string;
  /** The number the badge draws for this handle. */
  score: number;
  tier: string;
  /** Shared by everyone on the same score. Two 80s are both first, and the
   * next place is third. Ordering inside a tie is alphabetical and carries no
   * meaning, which is why it must not look like a ranking. */
  rank: number;
}

/** Candidates are re-scored live, so the pool is wider than the podium: EMA
 * smoothing can hold a rising handle just below a falling one in the stored
 * ordering, and some candidates will not materialize at all. */
const CANDIDATE_MULTIPLIER = 4;

/**
 * The platform's top scores, showing the same number the badge shows.
 *
 * Three rules hold this together.
 *
 * **Only people who signed up.** A snapshot exists for any handle whose badge
 * was ever rendered, and rendering a stranger's badge is as easy as embedding
 * it in a README, so ranking straight off snapshots would put developers on a
 * public podium they never opted into. `users` is written by exactly one
 * caller, the OAuth callback (#1239), which makes it the test for consent.
 *
 * **The board's number is the badge's number.** A snapshot's
 * `adjustedComposite` is the EMA-smoothed composite, kept so the trend line
 * stays continuous, while the badge draws the fresh one (#1001). Rows written
 * since migration 047 record that fresh number as `headlineScore`, and those
 * are read straight from one indexed query.
 *
 * **The podium is always full.** A row that predates `headlineScore` cannot be
 * published as-is, so rather than leaving a gap, the handle is materialized to
 * read the same headline `renderBadgeSvg` prints. Those run one at a time and
 * only until the podium fills — fetching a whole pool in parallel earns 403s
 * from GitHub, and a partial board is worse than a slightly slower revalidate.
 *
 * Called at build/revalidate time from the statically generated landing page,
 * never per request.
 */
export async function getLeaderboard(limit = 3): Promise<LeaderboardEntry[]> {
  if (limit <= 0) return [];

  const registered = await dbGetAllUserHandles();
  if (registered.length === 0) return [];

  const entries = await dbGetTopScoredProfiles(registered, limit);
  if (entries.length >= limit) return withSharedRanks(entries).slice(0, limit);

  const seen = new Set(entries.map((entry) => entry.handle));
  const candidates = (await dbGetScoredCandidates(registered, limit * CANDIDATE_MULTIPLIER))
    .filter((handle) => !seen.has(handle));

  for (const handle of candidates) {
    if (entries.length >= limit) break;
    let live: Awaited<ReturnType<typeof materializeDisplayProfile>> = null;
    try {
      live = await materializeDisplayProfile(handle);
    } catch {
      // A handle whose data cannot be fetched right now is skipped, and the
      // next candidate takes the place rather than the podium losing a row.
      continue;
    }
    if (!live) continue;
    entries.push({
      handle,
      score: live.displayImpact.adjustedComposite,
      tier: live.displayImpact.tier,
      rank: 0,
    });
  }

  return withSharedRanks(entries).slice(0, limit);
}

/** Standard competition ranking: equal scores take the same place, and the
 * place after a tie skips accordingly. */
function withSharedRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const ordered = [...entries].sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));
  let rank = 0;
  let previousScore: number | null = null;
  return ordered.map((entry, index) => {
    if (previousScore === null || entry.score !== previousScore) rank = index + 1;
    previousScore = entry.score;
    return { ...entry, rank };
  });
}
