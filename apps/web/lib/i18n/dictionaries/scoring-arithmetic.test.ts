import { describe, expect, it } from "vitest";
import { SCORING_V7_POLICY } from "@chapa/shared";
import { en } from "./en";
import { es } from "./es";

/**
 * The gate that should have existed already.
 *
 * `/about/scoring` published Impact v6 caps, weights and formulas for a full
 * release after the scorer moved to v7, and S17 — the task that owned that
 * copy — was recorded as verified the whole time. It read verified because
 * `claims.test.ts`, its only gate, checks four claim-level phrasings and never
 * looks at a number. Nothing compared the published arithmetic to the policy
 * the code runs.
 *
 * So this compares them. It reads the numbers out of the shipped dictionaries
 * and asserts them against `SCORING_V7_POLICY` — the same frozen object
 * `calculateCoreV7` reads — in both locales, and it fails on any v6 constant
 * that reappears. A policy change now breaks the copy until the copy is
 * updated, which is the only arrangement in which "the docs match the scorer"
 * survives contact with a second scoring revision.
 */

const dictionaries = { en, es } as const;

/** The shipped copy is typed as a generic translation tree, so the shape this
 *  test reads is stated once here rather than asserted at each access. */
interface ScoringCopy {
  readonly capsTableRows: readonly (readonly string[])[];
  readonly tiersTableRows: readonly (readonly string[])[];
  readonly deliveryFormula: string;
  readonly consistencyFormula: string;
  readonly qualityFormula: string;
  readonly breadthFormula: string;
  readonly craftFormula: string;
  readonly compositeFormula1: string;
  readonly philosophyBody2Highlight: string;
  readonly breadthIntro: string;
  readonly craftArtificerNote: string;
  readonly windowBody: string;
}

/** Every integer and decimal appearing in a string, as numbers. */
function numbersIn(value: string): number[] {
  return (value.match(/\d+(?:[.,]\d+)?/g) ?? []).map(raw => Number(raw.replace(",", ".")));
}

function scoring(locale: keyof typeof dictionaries): ScoringCopy {
  return (dictionaries[locale].about as Record<string, unknown>).scoring as ScoringCopy;
}

/** Flatten the whole scoring section to one searchable string. */
function allCopy(locale: keyof typeof dictionaries): string {
  const walk = (value: unknown): string =>
    typeof value === "string" ? value
      : Array.isArray(value) ? value.map(walk).join(" ")
      : value && typeof value === "object" ? Object.values(value).map(walk).join(" ")
      : "";
  return walk(scoring(locale));
}

describe.each(["en", "es"] as const)("published scoring arithmetic (%s)", locale => {
  const copy = scoring(locale);
  const caps = SCORING_V7_POLICY.caps;

  it("publishes exactly the policy's caps, and no others", () => {
    const published = new Set(copy.capsTableRows.flatMap(row => numbersIn(row[1]!)));
    const expected = new Set<number>([
      caps.delivery, caps.qualityCriterion, caps.consistency,
      caps.breadthProjects, caps.breadthCategories, caps.craftCriterion,
    ]);
    expect([...published].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
  });

  it("states each dimension's formula with its own cap and multiplier", () => {
    expect(numbersIn(copy.deliveryFormula)).toEqual([100, caps.delivery]);
    expect(numbersIn(copy.consistencyFormula)).toEqual([100, caps.consistency]);
    // Quality: 25 per criterion, four criteria, each capped at 12.
    const quality = numbersIn(copy.qualityFormula);
    expect(quality[0]).toBe(25);
    expect(quality.filter(n => n === caps.qualityCriterion)).toHaveLength(4);
    // Breadth: two 50-weighted terms, each capped at 4.
    const breadth = numbersIn(copy.breadthFormula);
    expect(breadth.filter(n => n === 50)).toHaveLength(2);
    expect(breadth.filter(n => n === caps.breadthProjects)).toHaveLength(2);
    // Craft: 25 per criterion, four criteria, each capped at 8.
    const craft = numbersIn(copy.craftFormula);
    expect(craft[0]).toBe(25);
    expect(craft.filter(n => n === caps.craftCriterion)).toHaveLength(4);
  });

  it("divides the core by the number of fixed weights, and names the weight", () => {
    const weights = Object.values(SCORING_V7_POLICY.coreWeights);
    expect(new Set(weights).size).toBe(1);
    expect(numbersIn(copy.compositeFormula1)).toEqual([weights.length]);
    // The weight itself is published, in whichever decimal mark the locale uses.
    expect(copy.philosophyBody2Highlight.replace(",", ".")).toContain(String(weights[0]));
  });

  it("publishes the policy's tier boundaries", () => {
    const thresholds = SCORING_V7_POLICY.tierThresholds;
    const published = new Set(copy.tiersTableRows.flatMap(row => numbersIn(row[1]!)));
    for (const boundary of [thresholds.solid, thresholds.high, thresholds.elite]) {
      expect(published).toContain(boundary);
    }
    // Classification runs on the unrounded core, so no row may publish a
    // rounded-down endpoint like 29.99 that implies a closed interval.
    expect([...published].every(Number.isInteger)).toBe(true);
  });

  it("publishes the Breadth eligibility threshold and the Craft descriptor minimum", () => {
    expect(numbersIn(copy.breadthIntro)).toContain(SCORING_V7_POLICY.breadthMinimumDates);
    expect(numbersIn(copy.craftArtificerNote)).toContain(SCORING_V7_POLICY.craftDescriptorMinimum);
  });

  it("publishes the window as calendar dates, not a rolling hour count", () => {
    expect(numbersIn(copy.windowBody)).toContain(365);
    expect(numbersIn(copy.windowBody)).toContain(364);
  });

  /**
   * The specific v6 machinery that survived on this page for a full release.
   * Each of these is a number or a name the v7 policy does not contain, so its
   * reappearance means the copy has drifted back rather than been rewritten.
   */
  it("contains no v6 scoring machinery", () => {
    const text = allCopy(locale);
    for (const forbidden of [
      /adjustedScore|recencyWeighted/i,
      /exponential moving|media m[oó]vil/i,
      /\b0[.,]85\b|\b0[.,]15\b/,       // the EMA and confidence-adjustment constants
      /review-to-PR|revisiones por PR/i,
      /batch size|tama[nñ]o de lote/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
    // v6 caps that no longer exist anywhere in the policy.
    const capNumbers = new Set<number>(Object.values(SCORING_V7_POLICY.caps));
    for (const legacyCap of [300, 150, 80, 60]) {
      if (capNumbers.has(legacyCap)) continue;
      expect(new Set(copy.capsTableRows.flatMap(row => numbersIn(row[1]!)))).not.toContain(legacyCap);
    }
  });
});

describe("the two locales publish the same arithmetic", () => {
  it("agrees on every number in the caps and tiers tables", () => {
    const capsOf = (locale: keyof typeof dictionaries) =>
      scoring(locale).capsTableRows.map(row => numbersIn(row[1]!));
    const tiersOf = (locale: keyof typeof dictionaries) =>
      scoring(locale).tiersTableRows.map(row => numbersIn(row[1]!));

    expect(capsOf("es")).toEqual(capsOf("en"));
    expect(tiersOf("es")).toEqual(tiersOf("en"));
  });
});
