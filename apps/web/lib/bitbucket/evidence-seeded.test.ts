import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import type { CollectorCheckpoint } from "@/lib/collection/plan";
import { seedFromPrior, type PriorObservation } from "@/lib/collection/seed";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectBitbucketSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const WORKSPACE = "{22222222-2222-2222-2222-222222222222}";
const REPO_A = "{33333333-3333-3333-3333-333333333333}";
const PROFILE = { uuid: "{11111111-1111-1111-1111-111111111111}", account_id: "acc1", display_name: "Juan" };
const input: SourceContextInput = {
  owner: "juan",
  requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "juan" },
  window,
  scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
};

function setupFetch() {
  const fetcher = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/2\.0/, "");
    if (path === "/user") return new Response(JSON.stringify(PROFILE), { status: 200 });
    if (path === "/user/workspaces") return new Response(JSON.stringify({ values: [{ workspace: { uuid: WORKSPACE } }], next: null }), { status: 200 });
    if (path === `/repositories/${encodeURIComponent(WORKSPACE)}`) return new Response(JSON.stringify({ values: [{ uuid: REPO_A, full_name: `juan/${REPO_A}` }], next: null }), { status: 200 });
    if (path.endsWith("/commits")) return new Response(JSON.stringify({ values: [], next: null }), { status: 200 });
    if (path.endsWith("/pullrequests")) return new Response(JSON.stringify({ values: [], next: null }), { status: 200 });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

function priorEvent(): NormalizedEngineeringEvent {
  const workItemId = `bitbucket.org:repository:${REPO_A}:pr:7`;
  return {
    schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId: PROFILE.uuid, actorId: PROFILE.uuid,
    repositoryId: REPO_A, eventId: "7", kind: "accepted_change", occurredAt: "2026-09-01T00:00:00.000Z", dataThrough: window.referenceTime,
    canonicalProjectId: `bitbucket.org:repository:${REPO_A}`, workItemId, artifactRevision: workItemId,
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

describe("collectBitbucketSlice from a seeded checkpoint", () => {
  it("registers per-repository operations for a repository seeded from the prior observation", async () => {
    setupFetch();
    const prior: PriorObservation = { dataThrough: "2026-09-04T00:00:00.000Z", events: [priorEvent()] };
    const seed = seedFromPrior(prior, window);

    let checkpoint: CollectorCheckpoint = seed.checkpoint;
    const stagedKeys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await collectBitbucketSlice(input, credential, checkpoint, { maxRequests: 5, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      checkpoint = result.checkpoint;
      if (result.done) break;
      if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
        throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
      }
    }

    // Discovery re-finds REPO_A via the workspace repo listing, and it must
    // not have been pre-registered by the seed -- otherwise registerRepo's
    // known-id guard would silently skip creating these operations, and new
    // activity in REPO_A would never be fetched.
    expect(checkpoint.operations.some((op) => op.key === `commits:${REPO_A}`)).toBe(true);
    expect(checkpoint.operations.some((op) => op.key === `pullrequests:${REPO_A}`)).toBe(true);
  });
});
