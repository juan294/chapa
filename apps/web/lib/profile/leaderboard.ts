import "server-only";
import { renderableScore } from "./score-view-model";
import { dbGetScoredCandidates, dbGetTopScoredProfiles } from "@/lib/db/snapshots";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { materializeDisplayProfile } from "./materialize-profile";

export interface LeaderboardPlace {
  /** 1, 2, 3. A place is a score, so a tie is one place with several handles. */
  rank: number;
  /** The number the badge draws for everyone in this place. */
  score: number;
  tier: string;
  /** Alphabetical, which carries no meaning and is not presented as an order. */
  handles: string[];
}

/** Entries needed to find three distinct scores: ties collapse into one place,
 * so the pool has to be deeper than the number of places. */
const ENTRY_MULTIPLIER = 4;

/**
 * The platform's top three scores, showing the same number the badge shows.
 *
 * Four rules hold this together.
 *
 * **A place is a score, not a row.** Everyone on 80 shares first place and the
 * next score is second. Ranking each handle separately put two identical
 * scores in different positions, which reads as favouritism.
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
 * since migration 047 record that fresh number as `headlineScore`.
 *
 * **Three places, always.** A row that predates `headlineScore` is
 * materialized to read the badge's own headline rather than leaving a gap.
 * Those run one at a time and only until three places exist: fetching a pool
 * in parallel earns 403s from GitHub.
 *
 * Called at build/revalidate time from the statically generated landing page,
 * never per request.
 */
export async function getLeaderboard(places = 3): Promise<LeaderboardPlace[]> {
  if (places <= 0) return [];

  const registered = await dbGetAllUserHandles();
  if (registered.length === 0) return [];

  const scored = new Map<string, { score: number; tier: string }>();
  for (const entry of await dbGetTopScoredProfiles(registered, places * ENTRY_MULTIPLIER)) {
    scored.set(entry.handle, { score: entry.score, tier: entry.tier });
  }

  if (countPlaces(scored) < places) {
    const candidates = (await dbGetScoredCandidates(registered, places * ENTRY_MULTIPLIER))
      .filter((handle) => !scored.has(handle));

    for (const handle of candidates) {
      if (countPlaces(scored) >= places) break;
      let live: Awaited<ReturnType<typeof materializeDisplayProfile>> = null;
      try {
        live = await materializeDisplayProfile(handle);
      } catch {
        // A handle whose data cannot be fetched right now is skipped, and the
        // next candidate takes the place rather than the board losing one.
        continue;
      }
      if (!live) continue;
      // #1311 — ranked on the number the badge prints, which is the resolved
      // model's, not the v6 aggregate's.
      //
      // A v7 evidence range takes no place at all. The board shows one number
      // per place and links to a badge that would show an interval, and this
      // file's existing rule is that a handle whose stored number would
      // contradict its badge waits rather than appearing with the wrong one.
      // The same reasoning applies to a range: there is no single number to
      // publish, so the next candidate takes the place.
      const drawn = renderableScore(live.scoring);
      if (live.scoring.composite.kind !== "point" || drawn.tier === null) continue;
      scored.set(handle, { score: drawn.composite, tier: drawn.tier });
    }
  }

  return groupIntoPlaces(scored).slice(0, places);
}

function countPlaces(scored: Map<string, { score: number }>): number {
  return new Set([...scored.values()].map((entry) => entry.score)).size;
}

function groupIntoPlaces(scored: Map<string, { score: number; tier: string }>): LeaderboardPlace[] {
  const byScore = new Map<number, LeaderboardPlace>();
  for (const [handle, entry] of scored) {
    const place = byScore.get(entry.score);
    if (place) {
      place.handles.push(handle);
      continue;
    }
    byScore.set(entry.score, { rank: 0, score: entry.score, tier: entry.tier, handles: [handle] });
  }

  return [...byScore.values()]
    .sort((a, b) => b.score - a.score)
    .map((place, index) => ({
      ...place,
      rank: index + 1,
      handles: [...place.handles].sort((a, b) => a.localeCompare(b)),
    }));
}
