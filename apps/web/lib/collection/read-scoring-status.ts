import "server-only";
import type { ScoringStatus } from "./scoring-status";

/**
 * Placeholder for the phase 4 backend (#1335 phase 4A: fan-in, `status.ts`'s
 * `deriveScoringStatus`, and the Supabase-backed read this wraps). Every
 * render surface (badge, OG image, share page) imports this exact module
 * path so swapping this placeholder for the real implementation requires no
 * caller change.
 *
 * Contract: resolves the owner's current `ScoringStatus` for `handle`, or
 * `null` when the authority read itself failed — never for a handle that is
 * simply unregistered, which is its own `{ kind: "unregistered" }` status.
 * Callers must treat both a thrown rejection and a resolved `null` as the
 * same "unavailable" case (see each call site's fallback behavior).
 *
 * Tests must mock this module — it always throws until 4A lands.
 */
export async function readScoringStatus(handle: string): Promise<ScoringStatus | null> {
  throw new Error(`readScoringStatus is provided by the phase 4 backend (handle: ${handle})`);
}
