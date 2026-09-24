import { describe, expect, it } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { seedFromPrior } from "./seed";

const window = createScoringWindow("2026-09-23T12:00:00Z");

function event(overrides: Partial<NormalizedEngineeringEvent> & { readonly eventId: string; readonly occurredAt: string }): NormalizedEngineeringEvent {
  return {
    schemaVersion: "v7", provider: "github", host: "github.com", subjectId: "U1", actorId: "U1",
    repositoryId: "R1", kind: "accepted_change", dataThrough: window.referenceTime,
    canonicalProjectId: "github:R1", workItemId: `github:${overrides.eventId}`, artifactRevision: "rev",
    artifactReferenceIds: [`github:${overrides.eventId}`], attribution: "individual", provenance: "source_observed",
    coverage: "complete", categories: [],
    measurements: {
      changedFiles: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      additions: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      deletions: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      leadTimeHours: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      hasDescription: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      hasIssueLink: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
      usesFeatureBranch: { status: "unknown", coverage: "unavailable", reasonCode: "not_supported" },
    },
    acceptance: { status: "unknown", coverage: "unavailable", reasonCode: "not_assessed" },
    ...overrides,
  };
}

describe("seedFromPrior", () => {
  it("keeps in-window prior events and drops out-of-window ones", () => {
    const inWindow = event({ eventId: "in", occurredAt: "2026-09-01T00:00:00.000Z" });
    const outOfWindow = event({ eventId: "out", occurredAt: "2024-01-01T00:00:00.000Z" });
    const result = seedFromPrior({ dataThrough: "2026-09-22T12:00:00.000Z", events: [inWindow, outOfWindow] }, window);
    expect(result.seededEvents).toEqual([inWindow]);
  });

  it("seeds discovered repository ids from the retained events", () => {
    const a = event({ eventId: "a", occurredAt: "2026-09-01T00:00:00.000Z", repositoryId: "R1" });
    const b = event({ eventId: "b", occurredAt: "2026-09-02T00:00:00.000Z", repositoryId: "R2" });
    const result = seedFromPrior({ dataThrough: null, events: [a, b] }, window);
    expect(result.checkpoint.discovered.repositoryIds).toEqual(["R1", "R2"]);
  });

  it("marks files of an already-merged accepted_change as a done, skippable operation", () => {
    const merged = event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z", kind: "accepted_change" });
    const result = seedFromPrior({ dataThrough: null, events: [merged] }, window);
    expect(result.checkpoint.operations).toContainEqual({ key: "files:github:PR1", cursor: null, done: true });
  });

  it("marks reviews as skippable only once the merge is more than 30 days before the reference time", () => {
    const recent = event({ eventId: "PR-recent", occurredAt: "2026-09-20T00:00:00.000Z" });
    const stale = event({ eventId: "PR-stale", occurredAt: "2026-06-01T00:00:00.000Z" });
    const result = seedFromPrior({ dataThrough: null, events: [recent, stale] }, window);
    const keys = result.checkpoint.operations.map((op) => op.key);
    expect(keys).not.toContain("reviews:github:PR-recent");
    expect(keys).toContain("reviews:github:PR-stale");
  });

  it("does not mark files/reviews skippable for a non-accepted_change event", () => {
    const review = event({ eventId: "REV1", occurredAt: "2026-09-01T00:00:00.000Z", kind: "review" });
    const result = seedFromPrior({ dataThrough: null, events: [review] }, window);
    expect(result.checkpoint.operations).toEqual([]);
  });

  it("carries the prior dataThrough into state for time-filterable operations", () => {
    const result = seedFromPrior({ dataThrough: "2026-09-22T12:00:00.000Z", events: [] }, window);
    expect(result.checkpoint.state?.seededDataThrough).toBe("2026-09-22T12:00:00.000Z");
  });

  it("is pure: repeated calls with the same input produce the same result", () => {
    const events = [event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z" })];
    const a = seedFromPrior({ dataThrough: "2026-09-20T00:00:00.000Z", events }, window);
    const b = seedFromPrior({ dataThrough: "2026-09-20T00:00:00.000Z", events }, window);
    expect(a).toEqual(b);
  });
});
