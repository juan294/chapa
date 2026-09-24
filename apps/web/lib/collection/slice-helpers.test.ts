import { describe, expect, it } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { createDiagnosticRecorder } from "@/lib/platform/evidence-diagnostics";
import type { SourceContextInput } from "@/lib/platform/source-context";
import {
  assembleSliceCoverage, buildSliceCheckpoint, emptySliceMeasurements, ensureSliceOperation, makeSliceStopFactory, newSliceEvents,
  validateSliceWindow, type MutableSliceOperation,
} from "./slice-helpers";

const window = createScoringWindow("2026-09-05T12:00:00Z");

function inputFor(overrides: Record<string, unknown> = {}): SourceContextInput {
  return {
    owner: "juan",
    requestedSource: { provider: "github", host: "github.com", login: "juan" },
    window: { ...window, ...overrides } as SourceContextInput["window"],
    scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
  };
}

function event(overrides: Partial<NormalizedEngineeringEvent> & { readonly eventId: string }): NormalizedEngineeringEvent {
  return {
    schemaVersion: "v7", provider: "github", host: "github.com", subjectId: "canonical", actorId: "canonical",
    repositoryId: "R1", kind: "accepted_change", occurredAt: "2026-09-01T00:00:00.000Z", dataThrough: window.referenceTime,
    canonicalProjectId: "github:R1", workItemId: `github:${overrides.eventId}`, artifactRevision: "rev",
    artifactReferenceIds: [`github:${overrides.eventId}`], attribution: "individual", provenance: "source_observed",
    coverage: "complete", categories: [], measurements: emptySliceMeasurements(),
    acceptance: { status: "unknown", coverage: "unavailable", reasonCode: "not_assessed" },
    ...overrides,
  };
}

describe("validateSliceWindow", () => {
  it("returns the re-derived window when it matches the caller's input exactly", () => {
    expect(validateSliceWindow(inputFor())).toEqual(window);
  });

  it("throws RangeError when calendarDays does not match the canonical 365-day window", () => {
    expect(() => validateSliceWindow(inputFor({ calendarDays: 30 }))).toThrow(RangeError);
  });

  it("throws RangeError when startInclusive disagrees with the re-derived window", () => {
    expect(() => validateSliceWindow(inputFor({ startInclusive: "2000-01-01T00:00:00.000Z" }))).toThrow(RangeError);
  });
});

describe("emptySliceMeasurements", () => {
  it("returns every EventMeasurements field as unavailable/not_supported", () => {
    const measurements = emptySliceMeasurements();
    for (const key of ["changedFiles", "additions", "deletions", "leadTimeHours", "hasDescription", "hasIssueLink", "usesFeatureBranch"] as const) {
      expect(measurements[key]).toEqual({ status: "unknown", coverage: "unavailable", reasonCode: "not_supported" });
    }
  });

  it("returns a fresh object each call -- callers may safely spread and mutate a copy", () => {
    expect(emptySliceMeasurements()).not.toBe(emptySliceMeasurements());
  });
});

describe("ensureSliceOperation", () => {
  it("appends a fresh not-yet-started operation when the key is missing", () => {
    const operations: MutableSliceOperation[] = [];
    ensureSliceOperation(operations, "commits:R1");
    expect(operations).toEqual([{ key: "commits:R1", cursor: null, done: false }]);
  });

  it("is a no-op when an operation for that key already exists, even if it has progress", () => {
    const operations: MutableSliceOperation[] = [{ key: "commits:R1", cursor: "page2", done: false }];
    ensureSliceOperation(operations, "commits:R1");
    expect(operations).toEqual([{ key: "commits:R1", cursor: "page2", done: false }]);
  });
});

describe("newSliceEvents", () => {
  it("returns discovered events that are not already in the staged key set", () => {
    const fresh = event({ eventId: "PR1" });
    const stale = event({ eventId: "PR2" });
    const newEvents = new Map([[engineeringEventKey(fresh), fresh], [engineeringEventKey(stale), stale]]);
    const stagedKeys = new Set([engineeringEventKey(stale)]);
    expect(newSliceEvents(newEvents, stagedKeys)).toEqual([fresh]);
  });

  it("returns everything when nothing is staged yet", () => {
    const fresh = event({ eventId: "PR1" });
    expect(newSliceEvents(new Map([[engineeringEventKey(fresh), fresh]]), new Set())).toEqual([fresh]);
  });
});

describe("makeSliceStopFactory", () => {
  it("records the diagnostic and returns the matching SourceDiagnostic shape", () => {
    const diag = createDiagnosticRecorder("github");
    const makeStop = makeSliceStopFactory(diag, "github");
    const stop = makeStop("profile", "http", 503, 30);
    expect(stop).toEqual({ provider: "github", operation: "profile", stopKind: "http", httpStatus: 503, retryAfterSeconds: 30 });
    expect(diag.diagnostics).toEqual([stop]);
  });

  it("defaults httpStatus/retryAfter to null when omitted", () => {
    const diag = createDiagnosticRecorder("gitlab");
    const makeStop = makeSliceStopFactory(diag, "gitlab");
    expect(makeStop("commits", "network")).toEqual({ provider: "gitlab", operation: "commits", stopKind: "network", httpStatus: null, retryAfterSeconds: null });
  });
});

describe("buildSliceCheckpoint", () => {
  it("assembles the version/operations/discovered/state envelope", () => {
    const operations: MutableSliceOperation[] = [{ key: "profile", cursor: null, done: true }];
    const checkpoint = buildSliceCheckpoint(operations, new Set(["r2", "r1"]), { pr: {} }, new Set(["not_supported"]));
    expect(checkpoint).toEqual({
      version: 1,
      operations: [{ key: "profile", cursor: null, done: true }],
      discovered: { repositoryIds: ["r1", "r2"] },
      state: { pr: {}, reasons: ["not_supported"] },
    });
  });

  it("merges extraState on top of the common envelope (GitLab's verifiedEmails, e.g.)", () => {
    const checkpoint = buildSliceCheckpoint([], new Set(), {}, new Set(), { verifiedEmails: ["a@example.com"] });
    expect(checkpoint.state).toEqual({ reasons: [], verifiedEmails: ["a@example.com"] });
  });
});

describe("assembleSliceCoverage", () => {
  const base = { provider: "github" as const, host: "github.com", subjectId: "canonical", window, repositoryIds: new Set(["r1"]) };

  it("reports complete status only when every eventKind is complete and there are no reasons", () => {
    const coverage = assembleSliceCoverage({
      ...base, explicit: true,
      eventKinds: { accepted_change: "complete", authored_commit: "complete" },
      reasons: new Set(),
    });
    expect(coverage.status).toBe("complete");
    expect(coverage.unknownPeriods).toEqual([]);
  });

  it("reports partial status and an unknownPeriod spanning the whole window when any eventKind is partial", () => {
    const coverage = assembleSliceCoverage({
      ...base, explicit: false,
      eventKinds: { accepted_change: "partial", authored_commit: "complete" },
      reasons: new Set(),
    });
    expect(coverage.status).toBe("partial");
    expect(coverage.unknownPeriods).toEqual([{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }]);
  });

  it("reports partial when eventKinds are all complete but a reason code is still recorded", () => {
    const coverage = assembleSliceCoverage({
      ...base, explicit: true,
      eventKinds: { accepted_change: "complete" },
      reasons: new Set(["not_accessible"]),
    });
    expect(coverage.status).toBe("partial");
  });

  it("derives discovery and repositoryDiscoveryComplete from explicit, and sorts repositoryIds/reasonCodes", () => {
    const coverage = assembleSliceCoverage({
      provider: "codeberg", host: "codeberg.org", subjectId: "s", window, repositoryIds: new Set(["r2", "r1"]),
      explicit: true, eventKinds: {}, reasons: new Set(["not_supported", "attribution_unknown"]),
    });
    expect(coverage.discovery).toBe("explicit_repositories");
    expect(coverage.repositoryDiscoveryComplete).toBe(true);
    expect(coverage.repositoryIds).toEqual(["r1", "r2"]);
    expect(coverage.reasonCodes).toEqual(["attribution_unknown", "not_supported"]);
    expect(coverage.source).toEqual({ provider: "codeberg", host: "codeberg.org", subjectId: "s" });
  });
});
