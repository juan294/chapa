/**
 * Sensitivity analysis over the v7 policy's normative choices.
 *
 * Every cap and weight in the policy is a published product choice, not a
 * measured constant. This script quantifies how much the published labels
 * depend on those choices: it varies each normalization cap by ±20% and each
 * core weight by ±5 percentage points (redistributing the remainder equally),
 * and reports how often the tier and archetype change.
 *
 * It reports sensitivity; it does not certify fairness. A large tier movement
 * under a small cap change is information about how normative the label is, and
 * belongs in the published results rather than being tuned away.
 *
 *   pnpm exec tsx scripts/scoring/validate-policy.ts [--json]
 */
import { createScoringWindow, type CoreScoringInputs, type ScoreBounds } from "@chapa/shared";
import { calculateCoreV7, coreArchetypeV7, coreTierV7 } from "../../apps/web/lib/impact/v7";

const REFERENCE = "2026-09-01T12:00:00.000Z";
const CAPS = { deliveryUnits: 120, quality: 12, activeIsoWeeks: 40, breadth: 4 } as const;

export interface Profile {
  readonly id: string;
  readonly deliveryUnits: number;
  readonly quality: number;
  readonly activeIsoWeeks: number;
  readonly eligibleProjects: number;
  readonly eligibleCategories: number;
}

/** A spread of shapes, not a sample of people: saturating, sparse, lopsided and
 * boundary-adjacent profiles, so a cap change has somewhere to show up. */
export const SENSITIVITY_PROFILES: readonly Profile[] = [
  { id: "sparse", deliveryUnits: 3, quality: 1, activeIsoWeeks: 4, eligibleProjects: 1, eligibleCategories: 1 },
  { id: "steady", deliveryUnits: 18, quality: 3, activeIsoWeeks: 14, eligibleProjects: 2, eligibleCategories: 2 },
  { id: "prolific", deliveryUnits: 90, quality: 9, activeIsoWeeks: 40, eligibleProjects: 4, eligibleCategories: 4 },
  { id: "saturating", deliveryUnits: 200, quality: 20, activeIsoWeeks: 52, eligibleProjects: 9, eligibleCategories: 4 },
  { id: "delivery-heavy", deliveryUnits: 80, quality: 0, activeIsoWeeks: 30, eligibleProjects: 1, eligibleCategories: 1 },
  { id: "practice-heavy", deliveryUnits: 6, quality: 10, activeIsoWeeks: 10, eligibleProjects: 1, eligibleCategories: 3 },
  { id: "reviewer", deliveryUnits: 0, quality: 8, activeIsoWeeks: 34, eligibleProjects: 3, eligibleCategories: 2 },
  { id: "docs", deliveryUnits: 12, quality: 2, activeIsoWeeks: 20, eligibleProjects: 2, eligibleCategories: 4 },
];

const N = (x: number, cap: number) => Math.log1p(Math.min(x, cap)) / Math.log1p(cap);

/** The published core, recomputed with explicit caps and weights so a variant
 * can be evaluated without touching the shipped scorer. */
export function coreWith(profile: Profile, caps: typeof CAPS, weights: readonly number[]): number {
  const dimensions = [
    100 * N(profile.deliveryUnits, caps.deliveryUnits),
    25 * 4 * N(profile.quality, caps.quality),
    100 * N(profile.activeIsoWeeks, caps.activeIsoWeeks),
    50 * N(profile.eligibleProjects, caps.breadth) + 50 * N(profile.eligibleCategories, caps.breadth),
  ];
  const core = dimensions.reduce((total, value, index) => total + value * weights[index]!, 0);
  // Saturated components can sum to 100 plus a float ulp; the published scale
  // is closed, so clamp rather than hand the tier function an out-of-domain value.
  return Math.max(0, Math.min(100, core));
}

function baselineInputs(profile: Profile): CoreScoringInputs {
  const bounds = (value: number) => ({ lower: value, upper: value }) as unknown as ScoreBounds;
  return {
    policyVersion: "v7", window: createScoringWindow(REFERENCE),
    counts: {
      deliveryUnits: bounds(profile.deliveryUnits) as never,
      quality: {
        rationale: bounds(profile.quality) as never, verification: bounds(profile.quality) as never,
        review_or_correction: bounds(profile.quality) as never, outcome_followup: bounds(profile.quality) as never,
      },
      activeIsoWeeks: bounds(profile.activeIsoWeeks) as never,
      eligibleProjects: bounds(profile.eligibleProjects) as never,
      eligibleCategories: bounds(Math.min(profile.eligibleCategories, 4)) as never,
    },
  };
}

export interface VariantResult {
  readonly variant: string;
  readonly tierChanges: number;
  readonly archetypeChanges: number;
  readonly maxCoreDelta: number;
  readonly profiles: number;
}

export function runSensitivity(): VariantResult[] {
  const baseline = SENSITIVITY_PROFILES.map(profile => {
    const calculated = calculateCoreV7(baselineInputs(profile));
    return {
      profile,
      core: calculated.core.composite.kind === "point" ? calculated.core.composite.value : Number.NaN,
      tier: calculated.core.tier,
      archetype: calculated.core.archetype,
    };
  });

  const variants: { name: string; caps: typeof CAPS; weights: number[] }[] = [];
  const equal = [0.25, 0.25, 0.25, 0.25];
  for (const [key, value] of Object.entries(CAPS) as [keyof typeof CAPS, number][]) {
    for (const factor of [0.8, 1.2]) {
      variants.push({ name: `cap:${key}:${factor === 0.8 ? "-20%" : "+20%"}`, caps: { ...CAPS, [key]: value * factor }, weights: equal });
    }
  }
  const names = ["delivery", "quality", "consistency", "breadth"];
  for (const [index, name] of names.entries()) {
    for (const delta of [-0.05, 0.05]) {
      const weights = equal.map((weight, position) =>
        position === index ? weight + delta : weight - delta / 3);
      variants.push({ name: `weight:${name}:${delta > 0 ? "+5pp" : "-5pp"}`, caps: CAPS, weights });
    }
  }

  return variants.map(variant => {
    let tierChanges = 0, archetypeChanges = 0, maxCoreDelta = 0;
    for (const row of baseline) {
      const core = coreWith(row.profile, variant.caps, variant.weights);
      maxCoreDelta = Math.max(maxCoreDelta, Math.abs(core - row.core));
      if (coreTierV7(core) !== row.tier) tierChanges++;
      const dims = {
        delivery: 100 * N(row.profile.deliveryUnits, variant.caps.deliveryUnits),
        quality: 100 * N(row.profile.quality, variant.caps.quality),
        consistency: 100 * N(row.profile.activeIsoWeeks, variant.caps.activeIsoWeeks),
        breadth: 50 * N(row.profile.eligibleProjects, variant.caps.breadth) + 50 * N(row.profile.eligibleCategories, variant.caps.breadth),
      };
      if (coreArchetypeV7(dims) !== row.archetype) archetypeChanges++;
    }
    return { variant: variant.name, tierChanges, archetypeChanges, maxCoreDelta, profiles: baseline.length };
  });
}

if (process.argv[1]?.endsWith("validate-policy.ts")) {
  const results = runSensitivity();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    process.stdout.write(`Sensitivity over ${SENSITIVITY_PROFILES.length} profile shapes\n\n`);
    process.stdout.write("| Variant | Tier changes | Archetype changes | Max core delta |\n| --- | --- | --- | --- |\n");
    for (const row of results) {
      process.stdout.write(`| ${row.variant} | ${row.tierChanges}/${row.profiles} | ${row.archetypeChanges}/${row.profiles} | ${row.maxCoreDelta.toFixed(2)} |\n`);
    }
  }
}
