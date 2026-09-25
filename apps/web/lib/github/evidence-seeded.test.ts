import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import type { CollectorCheckpoint } from "@/lib/collection/plan";
import { seedFromPrior, type PriorObservation } from "@/lib/collection/seed";
import { emptySliceMeasurements } from "@/lib/collection/slice-helpers";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitHubSlice } from "./evidence";

vi.mock("@/lib/env", () => ({ getGithubToken: () => undefined }));

const window = createScoringWindow("2026-09-05T12:00:00Z");
const actor = { id: "U1", login: "alice" };
const REPO = "R1";
const input: SourceContextInput = {
  owner: "alice",
  requestedSource: { provider: "github", host: "github.com", login: "alice" },
  window,
  scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
};
const credential = { token: null };

const page = (nodes: unknown[], next: string | null = null, totalCount = nodes.length) => ({ nodes, totalCount, pageInfo: { hasNextPage: next !== null, endCursor: next } });

type Handler = (variables: Record<string, unknown>) => unknown;
function mockApi(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    V7Profile: () => ({ user: { ...actor, name: "Alice", avatarUrl: null } }),
    V7Repositories: () => ({ user: { repositories: page([{ id: REPO, nameWithOwner: "alice/repo" }]) } }),
    V7ContributedRepositories: () => ({ user: { repositoriesContributedTo: page([]) } }),
    V7MergedChanges: () => ({ search: { issueCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } }),
    V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
    V7Commits: () => ({ node: { isEmpty: true, defaultBranchRef: null } }),
    ...overrides,
  };
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    const operation = /query (\w+)/.exec(query)?.[1] ?? "unknown";
    const result = handlers[operation]?.(variables);
    if (!result) throw new Error(`Unexpected operation ${operation} (${JSON.stringify(variables)})`);
    return new Response(JSON.stringify({ data: result }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

function priorEvent(): NormalizedEngineeringEvent {
  return {
    schemaVersion: "v7", provider: "github", host: "github.com", subjectId: "U1", actorId: "U1",
    repositoryId: REPO, eventId: "PR1", kind: "accepted_change", occurredAt: "2026-09-01T00:00:00.000Z", dataThrough: window.referenceTime,
    canonicalProjectId: `github:${REPO}`, workItemId: "github:PR1", artifactRevision: "rev",
    artifactReferenceIds: ["github:PR1"], attribution: "individual", provenance: "source_observed",
    coverage: "complete", categories: [],
    measurements: emptySliceMeasurements(),
    acceptance: { status: "unknown", coverage: "unavailable", reasonCode: "not_assessed" },
  };
}

describe("collectGitHubSlice from a seeded checkpoint", () => {
  it("registers per-repository operations for a repository seeded from the prior observation", async () => {
    const fetcher = mockApi();
    const prior: PriorObservation = { events: [priorEvent()] };
    const seed = seedFromPrior(prior, window);
    expect(seed.checkpoint.operations).toContainEqual({ key: "files:github:PR1", cursor: null, done: true });

    let checkpoint: CollectorCheckpoint = seed.checkpoint;
    const stagedKeys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await collectGitHubSlice(input, credential, checkpoint, { maxRequests: 5, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      checkpoint = result.checkpoint;
      if (result.done) break;
      if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
        throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
      }
    }

    // Discovery re-finds R1, and it must not have been pre-registered by the
    // seed -- otherwise registerRepo's known-id guard would silently skip
    // creating this operation, and new commits in R1 would never be fetched.
    expect(checkpoint.operations.some((op) => op.key === `commits:${REPO}`)).toBe(true);
    // The seeded files: operation stays pre-marked done and is never re-fetched.
    expect(checkpoint.operations.find((op) => op.key === "files:github:PR1")).toEqual({ key: "files:github:PR1", cursor: null, done: true });
    expect(fetcher.mock.calls.some(([, init]) => String((init as RequestInit).body).includes("V7Files"))).toBe(false);
  });
});
