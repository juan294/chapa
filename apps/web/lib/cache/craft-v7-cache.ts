import "server-only";
import type { ScoringWindow } from "@chapa/shared";
import { dbReadCraftV7 } from "@/lib/db/craft-v7";

/**
 * Fresh authorized aggregate projection. S15 owns unified receipt caching;
 * a second Redis lookup after a complete ledger calculation saves no work.
 * Private reports, artifact locators and reviewer rationale never leave this boundary.
 */
export async function getFreshCraftV7(owner: string, actor: string, window: ScoringWindow) {
  const current = await dbReadCraftV7(owner, actor, window);
  return { inputs: current.inputs, result: current.result, trace: current.trace };
}
