import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import type { CollectorCheckpoint } from "@/lib/collection/plan";
import { seedFromPrior, type PriorObservation } from "@/lib/collection/seed";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectCodebergSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const REPO_A = "1";
const input: SourceContextInput = {
  owner: "juan",
  requestedSource: { provider: "codeberg", host: "codeberg.org", login: "juan" },
  window,
  scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
};

function jsonHeaders(extra: Record<string, string> = {}) { return new Headers({ "content-type": "application/json", ...extra }); }

function setupFetch() {
  const fetcher = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (path === "/user") return new Response(JSON.stringify({ id: 1, login: "juan", full_name: "Juan", avatar_url: null }), { headers: jsonHeaders() });
    if (path === "/users/juan/repos") return new Response(JSON.stringify([{ id: Number(REPO_A), full_name: `juan/${REPO_A}` }]), { headers: jsonHeaders() });
    if (path === "/user/repos") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === "/users/juan/activities/feeds") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/commits")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/pulls")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/issues")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

function priorEvent(): NormalizedEngineeringEvent {
  const workItemId = `codeberg.org:repository:${REPO_A}:pr:9`;
  return {
    schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId: "1", actorId: "1",
    repositoryId: REPO_A, eventId: "9", kind: "accepted_change", occurredAt: "2026-09-01T00:00:00.000Z", dataThrough: window.referenceTime,
    canonicalProjectId: `codeberg.org:repository:${REPO_A}`, workItemId, artifactRevision: workItemId,
    artifactReferenceIds: [workItemId], attribution: "individual", provenance: "source_observed",
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
  };
}

describe("collectCodebergSlice from a seeded checkpoint", () => {
  it("registers per-repository operations for a repository seeded from the prior observation", async () => {
    const fetcher = setupFetch();
    const prior: PriorObservation = { dataThrough: "2026-09-04T00:00:00.000Z", events: [priorEvent()] };
    const seed = seedFromPrior(prior, window);
    const workItemId = "codeberg.org:repository:1:pr:9";
    expect(seed.checkpoint.operations).toContainEqual({ key: `files:${workItemId}`, cursor: null, done: true });

    let checkpoint: CollectorCheckpoint = seed.checkpoint;
    const stagedKeys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await collectCodebergSlice(input, credential, checkpoint, { maxRequests: 5, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      checkpoint = result.checkpoint;
      if (result.done) break;
      if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
        throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
      }
    }

    // Discovery re-finds REPO_A via the owner's repo listing, and it must not
    // have been pre-registered by the seed -- otherwise registerRepo's
    // known-id guard would silently skip creating these operations, and new
    // activity in REPO_A would never be fetched.
    expect(checkpoint.operations.some((op) => op.key === `commits:${REPO_A}`)).toBe(true);
    expect(checkpoint.operations.some((op) => op.key === `pulls:${REPO_A}`)).toBe(true);
    expect(checkpoint.operations.some((op) => op.key === `issues:${REPO_A}`)).toBe(true);
    // The seeded files: operation stays pre-marked done and is never re-fetched.
    expect(checkpoint.operations.find((op) => op.key === `files:${workItemId}`)).toEqual({ key: `files:${workItemId}`, cursor: null, done: true });
    expect(fetcher.mock.calls.some(([u]) => String(u).includes(`/pulls/9/files`))).toBe(false);
  });
});
