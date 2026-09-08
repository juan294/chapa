import "server-only";
import { observedReceiptViewModel, renderableScore, type ScoreViewModel } from "./score-view-model";
import { dbGetScoredCandidates, dbGetTopScoredProfiles, type TopScoredProfile } from "@/lib/db/snapshots";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { materializeDisplayProfile } from "./materialize-profile";
import { readRenderableReceipt } from "./score-model";

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
 * **A v7 evidence range takes no place at all**, on either path. The board
 * shows one number per place and links to a badge that would show an
 * interval; a handle whose stored number would contradict its badge waits
 * rather than appearing with the wrong one. Once a receipt is issued the badge
 * draws the receipt, so a stored headline is only the badge's number while no
 * receipt is drawable: each stored candidate is checked against
 * `readRenderableReceipt`, which returns before any query while
 * `scoring_v7_rendering` is off (LE-6-4).
 *
 * Called at build/revalidate time from the statically generated landing page,
 * never per request.
 */
export async function getLeaderboard(places = 3): Promise<LeaderboardPlace[]> {
  if (places <= 0) return [];

  const registered = await dbGetAllUserHandles();
  if (registered.length === 0) return [];

  const scored = new Map<string, { score: number; tier: string }>();
  /** Every handle already decided, ranked or not, so the live-fill path does
   * not spend a GitHub fetch re-deciding a range subject. */
  const settled = new Set<string>();
  const stored = await dbGetTopScoredProfiles(registered, places * ENTRY_MULTIPLIER);
  const drawnByStored = await Promise.all(stored.map((entry) => drawnForStored(entry)));
  for (const [index, entry] of stored.entries()) {
    settled.add(entry.handle);
    const drawn = drawnByStored[index];
    if (drawn === "unplaceable") continue;
    scored.set(entry.handle, drawn ?? { score: entry.score, tier: entry.tier });
  }

  if (countPlaces(scored) < places) {
    const candidates = (await dbGetScoredCandidates(registered, places * ENTRY_MULTIPLIER))
      .filter((handle) => !settled.has(handle));

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
      const drawn = placeable(live.scoring);
      if (drawn === "unplaceable") continue;
      scored.set(handle, drawn);
    }
  }

  return groupIntoPlaces(scored).slice(0, places);
}

/**
 * What the badge draws for a stored candidate once a receipt exists: the
 * receipt's point, `"unplaceable"` for a range, or `null` while no receipt is
 * drawable and the stored headline is still the badge's number. A failed read is unplaceable: an old aggregate cannot stand in for an
 * unavailable current receipt.
 */
async function drawnForStored(
  entry: TopScoredProfile,
): Promise<{ score: number; tier: string } | "unplaceable" | null> {
  let receipt: Awaited<ReturnType<typeof readRenderableReceipt>> = null;
  try {
    receipt = await readRenderableReceipt(entry.handle);
  } catch {
    return "unplaceable";
  }
  if (receipt && "unavailable" in receipt) return "unplaceable";
  return receipt ? placeable(observedReceiptViewModel(entry.handle, receipt)) : null;
}

/**
 * The one number a place can publish, or `"unplaceable"`. A range has no single
 * number to publish and a model with no tier has no tier to print beside it,
 * so the next candidate takes the place.
 */
function placeable(model: ScoreViewModel): { score: number; tier: string } | "unplaceable" {
  const drawn = renderableScore(model);
  if (model.composite.kind !== "point" || drawn.tier === null) return "unplaceable";
  return { score: drawn.composite, tier: drawn.tier };
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
