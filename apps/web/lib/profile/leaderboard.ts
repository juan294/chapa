import "server-only";
import { readScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { observedReceiptViewModel, renderableScore, type ScoreViewModel } from "./score-view-model";
import { dbGetScoredCandidates, dbGetTopScoredProfiles, type TopScoredProfile } from "@/lib/db/snapshots";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { materializeDisplayProfile } from "./materialize-profile";
import { readRenderableReceipt } from "./score-model";

export interface LeaderboardPlace {
  /** 1, 2, 3. A place is a score, so a tie is one place with several handles. */
  rank: number;
  policyVersion?: "v7.2";
  /** The number the badge draws for everyone in this place. */
  score: number;
  tier: string;
  /** Alphabetical, which carries no meaning and is not presented as an order. */
  handles: string[];
}

/** Entries needed to find three distinct scores: ties collapse into one place,
 * so the pool has to be deeper than the number of places. */
const ENTRY_MULTIPLIER = 4;

/** The board ranks canonical displayed points and groups equal points into a
 * single place, with handles alphabetically listed inside that tie. Current
 * policy considers every registered subject with a drawable current receipt;
 * unavailable and legacy-only subjects take no current-policy place.
 * The legacy branch retains its stored headline/provider fallback behavior. */
export async function getLeaderboard(places = 3, selection?: ScoringRenderSelection): Promise<LeaderboardPlace[]> {
  if (places <= 0) return [];

  const captured = selection ?? await readScoringRenderSelection();
  if (!captured.cacheable) return [];
  const registered = await dbGetAllUserHandles();
  if (registered.length === 0) return [];

  if (captured.machinePolicy === "v7.2") {
    const current = new Map<string, { score: number; tier: string }>();
    // Current ordering cannot inherit the legacy candidate cutoff. Read every
    // registered subject, in bounded batches, without fetching provider data.
    for (let offset = 0; offset < registered.length; offset += 16) {
      const handles = registered.slice(offset, offset + 16);
      const rows = await Promise.all(handles.map(handle => drawnForStored({ handle }, captured)));
      rows.forEach((row, index) => { if (row && row !== "unplaceable") current.set(handles[index]!, row); });
    }
    return groupIntoPlaces(current).slice(0, places).map(row => ({ ...row, policyVersion: "v7.2" }));
  }

  const scored = new Map<string, { score: number; tier: string }>();
  /** Every handle already decided, ranked or not, so the live-fill path does
   * not spend a GitHub fetch re-deciding a range subject. */
  const settled = new Set<string>();
  const stored = await dbGetTopScoredProfiles(registered, places * ENTRY_MULTIPLIER);
  const drawnByStored = await Promise.all(stored.map((entry) => drawnForStored(entry, captured)));
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
        live = await materializeDisplayProfile(handle, { scoringSelection: captured });
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
  entry: Pick<TopScoredProfile, "handle">,
  selection: ScoringRenderSelection,
): Promise<{ score: number; tier: string } | "unplaceable" | null> {
  let receipt: Awaited<ReturnType<typeof readRenderableReceipt>> = null;
  try {
    receipt = await readRenderableReceipt(entry.handle, selection);
  } catch {
    return "unplaceable";
  }
  if (receipt && "unavailable" in receipt) return "unplaceable";
  return receipt ? placeable(observedReceiptViewModel(entry.handle, receipt, selection.capturedAt)) : null;
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
