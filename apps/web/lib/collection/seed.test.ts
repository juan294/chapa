import { describe, expect, it } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { createPriorSeedAccumulator, seedFromPrior } from "./seed";

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
  it("filters 50,000 prior events one page at a time without retaining event bodies", () => {
    const seed = createPriorSeedAccumulator(window);
    let retained = 0;
    for (let page = 0; page < 50; page++) {
      const events = Array.from({ length: 1_000 }, (_, index) => event({
        eventId: `commit-${page}-${index}`, kind: "authored_commit",
        occurredAt: index === 0 ? "2020-01-01T00:00:00.000Z" : "2026-09-01T00:00:00.000Z",
      }));
      const filtered = seed.acceptPage(events);
      expect(filtered).toHaveLength(999);
      expect(filtered.length).toBeLessThanOrEqual(1_000);
      retained += filtered.length;
    }
    expect(seed.seededCount).toBe(retained);
    expect(seed.finish()).toMatchObject({ operations: [], discovered: { repositoryIds: [] } });
    expect("seededEvents" in seed).toBe(false);
  });

  it("keeps in-window prior events and drops out-of-window ones", () => {
    const inWindow = event({ eventId: "in", occurredAt: "2026-09-01T00:00:00.000Z" });
    const outOfWindow = event({ eventId: "out", occurredAt: "2024-01-01T00:00:00.000Z" });
    const result = seedFromPrior({ events: [inWindow, outOfWindow] }, window);
    expect(result.seededEvents).toEqual([inWindow]);
  });

  it("does not pre-register repositories", () => {
    const a = event({ eventId: "a", occurredAt: "2026-09-01T00:00:00.000Z", repositoryId: "R1", kind: "accepted_change" });
    const b = event({ eventId: "b", occurredAt: "2026-09-02T00:00:00.000Z", repositoryId: "R2", kind: "accepted_change" });
    const result = seedFromPrior({ events: [a, b] }, window);
    expect(result.checkpoint.discovered.repositoryIds).toEqual([]);
    expect(result.seededEvents).toEqual([a, b]);
    expect(result.checkpoint.operations).toContainEqual({ key: "files:github:a", cursor: null, done: true });
    expect(result.checkpoint.operations).toContainEqual({ key: "files:github:b", cursor: null, done: true });
  });

  it("marks files of an already-merged accepted_change as a done, skippable operation", () => {
    const merged = event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z", kind: "accepted_change" });
    const result = seedFromPrior({ events: [merged] }, window);
    expect(result.checkpoint.operations).toContainEqual({ key: "files:github:PR1", cursor: null, done: true });
  });

  it("marks reviews as skippable only once the merge is more than 30 days before the reference time", () => {
    const recent = event({ eventId: "PR-recent", occurredAt: "2026-09-20T00:00:00.000Z" });
    const stale = event({ eventId: "PR-stale", occurredAt: "2026-06-01T00:00:00.000Z" });
    const result = seedFromPrior({ events: [recent, stale] }, window);
    const keys = result.checkpoint.operations.map((op) => op.key);
    expect(keys).not.toContain("reviews:github:PR-recent");
    expect(keys).toContain("reviews:github:PR-stale");
  });

  it("does not mark files/reviews skippable for a non-accepted_change event", () => {
    const review = event({ eventId: "REV1", occurredAt: "2026-09-01T00:00:00.000Z", kind: "review" });
    const result = seedFromPrior({ events: [review] }, window);
    expect(result.checkpoint.operations).toEqual([]);
  });

  it("is pure: repeated calls with the same input produce the same result", () => {
    const events = [event({ eventId: "PR1", occurredAt: "2026-09-01T00:00:00.000Z" })];
    const a = seedFromPrior({ events }, window);
    const b = seedFromPrior({ events }, window);
    expect(a).toEqual(b);
  });
});
