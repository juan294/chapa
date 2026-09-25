import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import type { CollectorCheckpoint } from "@/lib/collection/plan";
import { seedFromPrior, type PriorObservation } from "@/lib/collection/seed";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitlabSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const PROJECT_A = "101";
const input: SourceContextInput = {
  owner: "juan",
  requestedSource: { provider: "gitlab", host: "gitlab.com", login: "juan" },
  window,
  scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
};

function jsonHeaders(extra: Record<string, string> = {}) { return new Headers({ "content-type": "application/json", ...extra }); }

function setupFetch() {
  const fetcher = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v4/, "");
    if (path === "/user") return new Response(JSON.stringify({ id: 1, username: "juan", name: "Juan", avatar_url: null, email: "juan@example.com", confirmed_at: "2020-01-01T00:00:00Z" }), { headers: jsonHeaders() });
    if (path === "/user/emails") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === "/merge_requests") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === "/users/1/projects") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === "/users/1/contributed_projects") return new Response(JSON.stringify([{ id: Number(PROJECT_A) }]), { headers: jsonHeaders() });
    if (path === `/projects/${PROJECT_A}/merge_requests`) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/repository/commits")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/issues")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

function priorEvent(): NormalizedEngineeringEvent {
  const workItemId = `gitlab.com:project:${PROJECT_A}:mr:1`;
  return {
    schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId: "1", actorId: "1",
    repositoryId: PROJECT_A, eventId: "1", kind: "accepted_change", occurredAt: "2026-09-01T00:00:00.000Z", dataThrough: window.referenceTime,
    canonicalProjectId: `gitlab.com:project:${PROJECT_A}`, workItemId, artifactRevision: workItemId,
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

describe("collectGitlabSlice from a seeded checkpoint", () => {
  it("registers per-repository operations for a project seeded from the prior observation", async () => {
    setupFetch();
    const prior: PriorObservation = { dataThrough: "2026-09-04T00:00:00.000Z", events: [priorEvent()] };
    const seed = seedFromPrior(prior, window);

    let checkpoint: CollectorCheckpoint = seed.checkpoint;
    const stagedKeys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await collectGitlabSlice(input, credential, checkpoint, { maxRequests: 5, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      checkpoint = result.checkpoint;
      if (result.done) break;
      if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
        throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
      }
    }

    // Discovery re-finds PROJECT_A via contributed_projects, and it must not
    // have been pre-registered by the seed -- otherwise registerRepo's
    // known-id guard would silently skip creating these operations, and new
    // activity in PROJECT_A would never be fetched.
    expect(checkpoint.operations.some((op) => op.key === `commits:${PROJECT_A}`)).toBe(true);
    expect(checkpoint.operations.some((op) => op.key === `issues:${PROJECT_A}`)).toBe(true);
    expect(checkpoint.operations.some((op) => op.key === `merge_requests:${PROJECT_A}`)).toBe(true);
  });
});
