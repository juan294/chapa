import "server-only";
import { observedReceiptViewModel, renderableScore, type ScoreViewModel } from "./score-view-model";
import { dbGetAllUserHandles } from "@/lib/db/users";
import { readRenderableReceipt } from "./score-model";

export interface LeaderboardPlace {
  /** 1, 2, 3. A place is a score, so a tie is one place with several handles. */
  rank: number;
  policyVersion: "v7.2";
  /** The number the badge draws for everyone in this place. */
  score: number;
  tier: string;
  /** Alphabetical, which carries no meaning and is not presented as an order. */
  handles: string[];
}

/** The board ranks canonical displayed points and groups equal points into a
 * single place, with handles alphabetically listed inside that tie. Every
 * registered subject with a drawable current receipt is considered;
 * unavailable and not-yet-scored subjects take no place (#1335 phase 5 —
 * the legacy stored-headline/candidate-materialization branch is retired
 * along with `metrics_snapshots`, and the retired DB-backed render-selector
 * this used to gate on is retired too — v7.2 is the one rendered policy). */
export async function getLeaderboard(places = 3): Promise<LeaderboardPlace[]> {
  if (places <= 0) return [];

  const registered = await dbGetAllUserHandles();
  if (registered.length === 0) return [];

  const current = new Map<string, { score: number; tier: string }>();
  // Read every registered subject, in bounded batches, without fetching
  // provider data.
  for (let offset = 0; offset < registered.length; offset += 16) {
    const handles = registered.slice(offset, offset + 16);
    const rows = await Promise.all(handles.map(handle => drawnForRegistered(handle)));
    rows.forEach((row, index) => { if (row) current.set(handles[index]!, row); });
  }
  return groupIntoPlaces(current).slice(0, places).map(row => ({ ...row, policyVersion: "v7.2" as const }));
}

/**
 * What the badge draws for a registered subject: the receipt's point, or
 * `null` for a range, an unavailable read, or no receipt drawable yet
 * (collection in progress or never scored) — the subject takes no place.
 */
async function drawnForRegistered(handle: string): Promise<{ score: number; tier: string } | null> {
  const receipt = await readRenderableReceipt(handle);
  return receipt ? placeable(observedReceiptViewModel(handle, receipt)) : null;
}

/**
 * The one number a place can publish, or `null`. A range has no single
 * number to publish and a model with no tier has no tier to print beside it,
 * so the next candidate takes the place.
 */
function placeable(model: ScoreViewModel): { score: number; tier: string } | null {
  const drawn = renderableScore(model);
  if (model.composite.kind !== "point" || drawn.tier === null) return null;
  return { score: drawn.composite, tier: drawn.tier };
}

function groupIntoPlaces(scored: Map<string, { score: number; tier: string }>): Omit<LeaderboardPlace, "policyVersion">[] {
  const byScore = new Map<number, Omit<LeaderboardPlace, "policyVersion">>();
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
