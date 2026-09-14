import "server-only";
import { dbReadScoringFlagDirect } from "./db/feature-flags";
import { getScoringV7RenderingEnabledEnv } from "./env";
import { withTimeout } from "./async/with-timeout";

export interface ScoringRenderSelection {
  readonly enabled: boolean;
  readonly machinePolicy: "v6" | "v7.2";
  readonly cacheable: boolean;
  readonly capturedAt: number;
}
const DAY_MS = 86_400_000;
const utcDay = (instant: number) => Math.floor(instant / DAY_MS);
const SELECTION_TTL_MS = 5000;
const LOOKUP_DEADLINE_MS = 500;
let cached: ScoringRenderSelection | null = null;
let generation = 0;

export function invalidateScoringRenderSelection(): void {
  cached = null;
  generation++;
}

/** Bypass generic flag caches: this selection bounds image rollback. Failed or
 * late reads never extend a successful policy cache or authorize image writes.
 */
export async function readScoringRenderSelection(options: { force?: boolean } = {}): Promise<ScoringRenderSelection> {
  const capturedAt = Date.now();
  if (!options.force && cached && capturedAt >= cached.capturedAt && capturedAt - cached.capturedAt < SELECTION_TTL_MS && utcDay(capturedAt) === utcDay(cached.capturedAt)) return cached;
  const startedGeneration = generation;
  let enabled: boolean;
  let cacheable = true;
  try {
    const direct = await withTimeout(dbReadScoringFlagDirect(), LOOKUP_DEADLINE_MS, "scoring selection");
    enabled = direct ?? getScoringV7RenderingEnabledEnv()?.trim() === "true";
    cacheable = generation === startedGeneration;
  } catch {
    enabled = getScoringV7RenderingEnabledEnv()?.trim() === "true";
    cacheable = false;
  }
  const selection = Object.freeze({ enabled, machinePolicy: enabled ? "v7.2" as const : "v6" as const, cacheable, capturedAt });
  // An older slow successful request cannot displace a newer authoritative read.
  if (cacheable && (!cached || cached.capturedAt <= capturedAt)) cached = selection;
  return selection;
}

export function sameScoringRenderSelection(a: ScoringRenderSelection, b: ScoringRenderSelection): boolean {
  return a.cacheable && b.cacheable && a.enabled === b.enabled && a.machinePolicy === b.machinePolicy;
}

/** No stale-while-revalidate or stale-if-error extension accompanies this age. */
export function scoringResponseMaxAge(selection: ScoringRenderSelection): number {
  if (!selection.cacheable) return 0;
  const now = Date.now();
  const ageBudget = 300 - Math.max(0, now - selection.capturedAt) / 1000;
  // Current report eligibility can expire at midnight without a receipt write.
  const dayBudget = selection.machinePolicy === "v7.2"
    ? ((utcDay(selection.capturedAt) + 1) * DAY_MS - now) / 1000
    : 300;
  return Math.max(0, Math.floor(Math.min(300, ageBudget, dayBudget)));
}
