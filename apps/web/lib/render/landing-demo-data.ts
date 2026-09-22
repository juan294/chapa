import type { ImpactV6Result } from "@chapa/shared";
import { deriveArchetype } from "@/lib/impact/v6";
import { getTier } from "@/lib/impact/utils";
import { DEMO_IMPACT } from "./demoData";

/** Curated illustrative values, not a computed result of DEMO_STATS.
 * Keep this aspirational landing sample separate from the shared Studio demo. */
const dimensions = { delivery: 96, quality: 88, consistency: 94, breadth: 90, craft: 92 };
const adjustedComposite = 92;
const sample: ImpactV6Result = {
  handle: DEMO_IMPACT.handle,
  profileType: DEMO_IMPACT.profileType,
  computedAt: DEMO_IMPACT.computedAt,
  dimensions,
  archetype: deriveArchetype(dimensions, DEMO_IMPACT.profileType),
  compositeScore: 92,
  confidence: 100,
  confidencePenalties: [],
  adjustedComposite,
  tier: getTier(adjustedComposite),
};

Object.freeze(sample.dimensions);
Object.freeze(sample.confidencePenalties);
export const LANDING_IMPACT = Object.freeze(sample);
