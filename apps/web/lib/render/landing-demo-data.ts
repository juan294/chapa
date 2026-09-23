import type { ImpactV6Result } from "@chapa/shared";
import { getTier } from "@/lib/impact/utils";
import { DEMO_IMPACT } from "./demoData";

/** Curated illustrative values, not a computed result of DEMO_STATS.
 * Keep this aspirational landing sample separate from the shared Studio demo.
 *
 * #1335 phase 5 ("delete v6") — `deriveArchetype` (`lib/impact/v6.ts`) is
 * gone with the rest of the legacy aggregate engine. This literal shape is
 * still `ImpactV6Result` because `LocalizedHome.tsx`/`LandingContent.tsx`
 * (outside this workstream's file ownership) still consume it as one; the
 * archetype a v6 derivation would have produced for this dimension set is
 * documented in CLAUDE.md ("92 / Elite / Balanced") and locked in by this
 * file's own test, so hardcoding it here loses no coverage.
 */
const dimensions = { delivery: 96, quality: 88, consistency: 94, breadth: 90, craft: 92 };
const adjustedComposite = 92;
const sample: ImpactV6Result = {
  handle: DEMO_IMPACT.handle,
  profileType: DEMO_IMPACT.profileType,
  computedAt: DEMO_IMPACT.computedAt,
  dimensions,
  archetype: "Balanced",
  compositeScore: 92,
  confidence: 100,
  confidencePenalties: [],
  adjustedComposite,
  tier: getTier(adjustedComposite),
};

Object.freeze(sample.dimensions);
Object.freeze(sample.confidencePenalties);
export const LANDING_IMPACT = Object.freeze(sample);
