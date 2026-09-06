import { describe, expect, it } from "vitest";
import { deriveCoreEvidenceV7 } from "./v7-evidence";
import { computeImpactV7 } from "./v7";
import {
  assessment,
  COMPLETE_COVERAGE,
  event,
  input,
  PARTIAL_COVERAGE,
  QUALITY_CRITERIA,
  WORK_ROLES,
} from "@/test/fixtures/scoring-v7/matched-pairs";
import type { NormalizedEngineeringEvent } from "@chapa/shared";

/**
 * Mandatory invariants, as matched pairs.
 *
 * Each test changes exactly one thing the policy says must not matter and holds
 * everything else identical. What passes here is arithmetic conformance to this
 * rubric — not empirical fairness. The pilot in
 * `docs/research/scoring-v7-validation-protocol.md` is the only thing that can
 * speak to the latter, and it is not complete.
 */
const dates = ["2026-06-01", "2026-06-15", "2026-07-01", "2026-07-20", "2026-08-01", "2026-08-15"];
const score = (value: ReturnType<typeof computeImpactV7>) => value.core;

describe("AI usage, disclosure and tool choice never change the core", () => {
  it("scores identical evidence identically whether or not an AI tool was disclosed", () => {
    const withoutDisclosure = dates.map((date, index) => event(`w-${index}`, date));
    // Same work, same artifacts, same acceptance — only the recorded provenance
    // of the authoring process differs.
    const withDisclosure: NormalizedEngineeringEvent[] = withoutDisclosure.map(row => ({
      ...row, artifactReferenceIds: [...row.artifactReferenceIds, "ai-session-disclosure"],
    }));

    expect(computeImpactV7(input(withDisclosure)).inputs).toEqual(computeImpactV7(input(withoutDisclosure)).inputs);
    expect(score(computeImpactV7(input(withDisclosure)))).toEqual(score(computeImpactV7(input(withoutDisclosure))));
  });

  it("gives a larger change no more credit than a one-line change on the same day", () => {
    const large = input([WORK_ROLES.implementation("a", "2026-08-01")]);
    const oneLine = input([WORK_ROLES.one_line_change("a", "2026-08-01")]);
    const deletion = input([WORK_ROLES.deletion_only("a", "2026-08-01")]);

    expect(computeImpactV7(oneLine).inputs).toEqual(computeImpactV7(large).inputs);
    expect(computeImpactV7(deletion).inputs).toEqual(computeImpactV7(large).inputs);
  });

  it("gives no credit for splitting one day's work across many artifacts", () => {
    const single = deriveCoreEvidenceV7(input([event("only", "2026-08-01")]));
    const split = deriveCoreEvidenceV7(input(Array.from({ length: 40 }, (_, i) => event(`split-${i}`, "2026-08-01"))));

    expect(split.inputs.counts.deliveryUnits).toEqual(single.inputs.counts.deliveryUnits);
    expect(split.inputs.counts.activeIsoWeeks).toEqual(single.inputs.counts.activeIsoWeeks);
  });
});

describe("tenure and account age are not evidence", () => {
  it("scores identical evidence identically regardless of how old the account is", () => {
    const events = dates.map((date, index) => event(`t-${index}`, date));
    // Account age lives outside the evidence input entirely; the invariant this
    // pins is that nothing in the scored input can carry it.
    const scored = computeImpactV7(input(events));

    expect(Object.keys(scored.inputs.counts).sort())
      .toEqual(["activeIsoWeeks", "deliveryUnits", "eligibleCategories", "eligibleProjects", "quality"]);
    expect(JSON.stringify(scored.inputs)).not.toMatch(/createdAt|accountAge|tenure/i);
  });
});

describe("every represented work role can be scored", () => {
  it.each(Object.keys(WORK_ROLES) as (keyof typeof WORK_ROLES)[])("scores a %s profile without throwing", role => {
    const events = dates.map((date, index) => WORK_ROLES[role](`${role}-${index}`, date));
    const scored = computeImpactV7(input(events));

    expect(scored.core.composite).toBeDefined();
    // A role whose evidence carries no acceptance event contributes activity
    // without delivery units; it must never produce a negative or absent bound.
    expect(scored.inputs.counts.deliveryUnits.lower).toBeGreaterThanOrEqual(0);
    expect(scored.inputs.counts.activeIsoWeeks.lower).toBeGreaterThanOrEqual(0);
  });

  it("credits a reviewer's active weeks without inventing delivery units", () => {
    const reviews = dates.map((date, index) => WORK_ROLES.review(`r-${index}`, date));
    const scored = deriveCoreEvidenceV7(input(reviews));

    expect(scored.inputs.counts.deliveryUnits).toEqual({ lower: 0, upper: 0 });
    expect(scored.inputs.counts.activeIsoWeeks.upper).toBeGreaterThan(0);
  });

  it("credits a direct-push author whose acceptance is a first-reachability event", () => {
    const pushes = dates.map((date, index) => WORK_ROLES.direct_push(`p-${index}`, date));

    expect(deriveCoreEvidenceV7(input(pushes)).inputs.counts.deliveryUnits.lower).toBeGreaterThan(0);
  });
});

describe("missing evidence widens the range and never lowers the score", () => {
  const events = dates.map((date, index) => event(`v-${index}`, date));
  const complete = deriveCoreEvidenceV7(input(events, [], [COMPLETE_COVERAGE]));
  const redacted = deriveCoreEvidenceV7(input(events, [], [PARTIAL_COVERAGE]));

  it("keeps every lower bound unchanged when a source is redacted", () => {
    expect(redacted.inputs.counts.deliveryUnits.lower).toBe(complete.inputs.counts.deliveryUnits.lower);
    expect(redacted.inputs.counts.activeIsoWeeks.lower).toBe(complete.inputs.counts.activeIsoWeeks.lower);
    expect(redacted.inputs.counts.eligibleProjects.lower).toBe(complete.inputs.counts.eligibleProjects.lower);
  });

  it("raises upper bounds so the range contains the complete-evidence result", () => {
    expect(redacted.inputs.counts.deliveryUnits.upper).toBeGreaterThanOrEqual(complete.inputs.counts.deliveryUnits.upper);
    const completeScore = computeImpactV7(input(events, [], [COMPLETE_COVERAGE])).core.composite;
    const redactedScore = computeImpactV7(input(events, [], [PARTIAL_COVERAGE])).core.composite;

    const lower = redactedScore.kind === "point" ? redactedScore.value : redactedScore.lower;
    const upper = redactedScore.kind === "point" ? redactedScore.value : redactedScore.upper;
    const exact = completeScore.kind === "point" ? completeScore.value : completeScore.lower;
    expect(lower).toBeLessThanOrEqual(exact + 1e-10);
    expect(upper).toBeGreaterThanOrEqual(exact - 1e-10);
  });

  it("records the redaction as its own limitation rather than absorbing it", () => {
    // Both profiles carry `not_assessed`: neither has rubric verdicts. Only the
    // redacted one carries the incomplete discovery that produced the range.
    expect(complete.limitations).toContain("not_assessed");
    expect(complete.limitations).not.toContain("discovery_incomplete");
    expect(redacted.limitations).toContain("discovery_incomplete");
  });
});

describe("unknown evidence is not zero evidence", () => {
  it("separates an inspected rejection from an unassessed item", () => {
    const inspected = deriveCoreEvidenceV7(input(
      [event("a")],
      QUALITY_CRITERIA.map(criterion => assessment("a", criterion, "rejected")),
    ));
    const unassessed = deriveCoreEvidenceV7(input([event("a")]));

    for (const criterion of QUALITY_CRITERIA) {
      // An inspected item that did not demonstrate the criterion is a closed
      // zero; an unassessed one is still open at the top.
      expect(inspected.inputs.counts.quality[criterion]).toEqual({ lower: 0, upper: 0 });
      expect(unassessed.inputs.counts.quality[criterion].upper).toBeGreaterThan(0);
    }
  });

  it("scores a truthfully empty profile as an exact zero, not as unknown", () => {
    const empty = computeImpactV7(input([]));

    expect(empty.core.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    expect(empty.core.tier).toBe("Emerging");
  });
});

describe("monotonicity", () => {
  it("never lowers a bound when evidence is added", () => {
    const base = dates.slice(0, 3).map((date, index) => event(`m-${index}`, date));
    const more = [...base, ...dates.slice(3).map((date, index) => event(`m-extra-${index}`, date))];

    const before = deriveCoreEvidenceV7(input(base)).inputs.counts;
    const after = deriveCoreEvidenceV7(input(more)).inputs.counts;

    expect(after.deliveryUnits.lower).toBeGreaterThanOrEqual(before.deliveryUnits.lower);
    expect(after.activeIsoWeeks.lower).toBeGreaterThanOrEqual(before.activeIsoWeeks.lower);
    expect(after.eligibleProjects.lower).toBeGreaterThanOrEqual(before.eligibleProjects.lower);
    for (const criterion of QUALITY_CRITERIA) {
      expect(after.quality[criterion].lower).toBeGreaterThanOrEqual(before.quality[criterion].lower);
    }
  });
});
