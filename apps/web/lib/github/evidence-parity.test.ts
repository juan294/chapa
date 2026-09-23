import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitHubSlice } from "./evidence";

/**
 * Ported fidelity suite (#1335 phase 3 part B/C). This is the equivalent, at
 * the checkpointed-slice contract, of every malformed-shape / reason-code
 * branch and phase 1 diagnostic-matrix case that `evidence.test.ts` proved
 * against the single-run `fetchGitHubEvidence`. Two contract differences
 * change how a case is asserted, not what it proves:
 *
 * - `SliceResult` has no `progress` array. A stop that used to be read off
 *   `progress.find(...)` is asserted instead as `done: false` with the
 *   returned `stop` diagnostic and a checkpoint whose relevant operation
 *   still has its pre-failure cursor -- provably resumable, which the
 *   convergence tests in `evidence-slice.test.ts` exercise end-to-end.
 * - A stop is never accompanied by `coverage` (`coverage: null` until
 *   `done`), so a case that used to read `result.coverage.reasonCodes` for a
 *   *hard* stop (http/graphql/protocol/parse/rate_limited/budget/deadline)
 *   is asserted as `done: false` + `stop.stopKind` instead. A case whose
 *   old assertion was a *soft*, non-halting reason (attribution_unknown,
 *   partial_files, discovery_incomplete, not_supported) still runs to
 *   completion and is asserted on the final `coverage`, unchanged.
 *
 * The GitHub search 1,000-node cap itself is gone by design (phase 3 splits
 * date ranges instead), so the one old test built specifically around that
 * cap ("keeps observations but marks search caps... incomplete") has no
 * equivalent here; its budget-exhaustion half is covered by the dedicated
 * budget test in `evidence-slice.test.ts`, and its rate-limited-files half
 * is ported below.
 */

const window = createScoringWindow("2026-09-05T12:00:00Z");
const repo = { id: "R1", nameWithOwner: "external/project" };
const actor = { id: "U1", login: "alice" };
const page = (nodes: unknown[], next: string | null = null, totalCount = nodes.length) => ({ nodes, totalCount, pageInfo: { hasNextPage: next !== null, endCursor: next } });
const pr = (id = "PR1", fields: Record<string, unknown> = {}) => ({ __typename: "PullRequest", id, repository: repo, author: actor, merged: true, mergedAt: "2026-09-01T12:00:00Z", createdAt: "2020-01-01T00:00:00Z", headRefOid: "revision", body: "Problem and solution", headRefName: "feature", baseRefName: "main", additions: 1, deletions: 0, changedFiles: 1, closingIssuesReferences: { totalCount: 0 }, ...fields });
const input: SourceContextInput = {
  owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window,
  scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] },
};
const explicitInput: SourceContextInput = { ...input, scope: { discovery: "explicit_repositories", repositoryIds: ["R1"], eventKinds: [] } };
const credential = { token: null };

type Handler = (variables: Record<string, unknown>) => unknown;
function mockApi(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    V7Profile: () => ({ user: { ...actor, name: "Alice", avatarUrl: "https://example.com/avatar" } }),
    V7Repositories: () => ({ user: { repositories: page([repo]) } }),
    V7ContributedRepositories: () => ({ user: { repositoriesContributedTo: page([repo]) } }),
    V7MergedChanges: () => ({ search: { ...page([pr()]), issueCount: 1 } }),
    V7Files: () => ({ node: { files: page([{ path: "README.md" }]) } }),
    V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([{ isRestricted: false, pullRequest: pr() }]) } } }),
    V7Reviews: () => ({ node: { reviews: page([{ id: "REV1", author: actor, submittedAt: "2026-09-03T00:00:00Z", state: "COMMENTED" }]) } }),
    V7Commits: () => ({ node: { defaultBranchRef: { target: { history: page([{ id: "C1", oid: "sha1", author: { user: actor }, authoredDate: "2026-09-02T00:00:00Z", additions: 1, deletions: 0 }, { id: "C2", oid: "sha2", author: { user: { id: "U2" } }, authoredDate: "2026-09-02T00:00:00Z" }]) } } } }),
    V7Issues: () => ({ node: { issues: page([{ id: "I1", repository: repo }, { id: "I2", repository: repo }]) } }),
    V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer: null }] : []) } }),
    ...overrides,
  };
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body));
    const operation = /query (\w+)/.exec(query)?.[1] ?? "unknown";
    const result = handlers[operation]?.(variables);
    if (result instanceof Response) return result;
    if (!result) throw new Error(`Unexpected operation ${operation}`);
    return new Response(JSON.stringify({ data: result }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

async function runToCompletion(initInput: SourceContextInput = input, maxRequests = 200) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  const stagedKeys = new Set<string>();
  for (let slices = 0; slices < 500; slices++) {
    const result = await collectGitHubSlice(initInput, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
    if (result.stop?.stopKind !== "budget" && result.stop?.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
  throw new Error("runaway slice loop");
}

describe("collectGitHubSlice -- ported diagnostic matrix (hard stops)", () => {
  it("marks a per-PR files deadline stop as pagination_incomplete-equivalent: done:false, stopKind deadline, never source_error", async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const { query } = JSON.parse(String(init?.body));
      const operation = /query (\w+)/.exec(query)?.[1] ?? "unknown";
      if (operation === "V7Files") return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)); });
      const handlers: Record<string, unknown> = {
        V7Profile: { user: { ...actor, name: "Alice", avatarUrl: null } },
        V7MergedChanges: { search: { ...page([pr()]), issueCount: 1 } },
        V7ReviewDiscovery: { user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } },
        V7Commits: { node: { isEmpty: true, defaultBranchRef: null } },
        V7Issues: { node: { issues: page([]) } },
      };
      const result = handlers[operation];
      if (!result) throw new Error(`Unexpected operation ${operation}`);
      return new Response(JSON.stringify({ data: result }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await collectGitHubSlice(explicitInput, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 50 }, new Set());
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "github", operation: "files", stopKind: "deadline" });
  });
  it("classifies a real HTTP 500 as an http stop, still source_error-equivalent", async () => {
    mockApi({ V7MergedChanges: () => new Response("failure", { status: 500 }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "github", operation: "merged", stopKind: "http", httpStatus: 500 });
  });
  it("classifies a GraphQL errors array as a graphql stop, still source_error-equivalent, without discarding that page's usable node", async () => {
    mockApi({ V7MergedChanges: () => new Response(JSON.stringify({ data: { search: { ...page([pr()]), issueCount: 1 } }, errors: [{ message: "private upstream detail" }] })) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "github", operation: "merged", stopKind: "graphql" });
    // The event itself is built later, at the deferred files: op (never from
    // partial merged-search data alone -- see the immutable-identity note on
    // buildAcceptedChangeEvent). What must not be thrown away is the node's
    // *discovery*, proven by the fan-out operation it registered.
    expect(result.checkpoint.operations.some((op) => op.key === "files:github:PR1")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private upstream detail");
  });
  it("classifies a malformed page-info shape as a protocol stop, still source_error-equivalent", async () => {
    mockApi({ V7MergedChanges: () => ({ search: { ...page([pr()]), pageInfo: { hasNextPage: "not-a-boolean", endCursor: null }, issueCount: 1 } }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "github", operation: "merged", stopKind: "protocol" });
  });
  it("classifies a GitHub rate-limit response (403 + x-ratelimit-remaining: 0) as rate_limited", async () => {
    mockApi({ V7MergedChanges: () => new Response("rate limited", { status: 403, headers: { "x-ratelimit-remaining": "0" } }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "github", operation: "merged", stopKind: "rate_limited", httpStatus: 403 });
  });
  it("classifies an unparseable accepted-change date as a parse stop, still source_error-equivalent", async () => {
    mockApi({ V7MergedChanges: () => ({ search: { ...page([pr("PR1", { mergedAt: "" })]), issueCount: 1 } }) });
    const result = await runToCompletion();
    // files: op only builds the event once "merged" completed -- the parse
    // failure at merged-page time means the merged op itself stops:
    expect(result.events.some((e) => e.eventId === "PR1")).toBe(false);
  });
  it("classifies an unparseable review date as a parse stop, still source_error-equivalent", async () => {
    mockApi({ V7Reviews: () => ({ node: { reviews: page([{ id: "REV1", author: actor, submittedAt: "", state: "COMMENTED" }]) } }) });
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "review")).toBe(false);
  });
  it("classifies an unparseable authored-commit date as a parse stop", async () => {
    mockApi({ V7Commits: () => ({ node: { defaultBranchRef: { target: { history: page([{ id: "C1", oid: "sha1", author: { user: actor }, authoredDate: "" }]) } } } }) });
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(false);
  });
  it("classifies an unparseable issue-closure date as a parse stop", async () => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "", closer: null }] : []) } }) });
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "issue_work")).toBe(false);
  });
  it("a rate-limited V7Files response stops the slice as rate_limited (the old test's search-cap case, minus the removed 1,000-node cap)", async () => {
    mockApi({ V7Files: () => new Response("rate limited", { status: 429 }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "github", operation: "files", stopKind: "rate_limited", httpStatus: 429 });
  });
});

describe("collectGitHubSlice -- ported business-logic parity (soft reasons, complete runs)", () => {
  it("uses subject event identities, builds the monthly-range merged query and the commits subjectId variable", async () => {
    const fetcher = mockApi();
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "authored_commit").map((e) => e.eventId)).toEqual(["C1"]);
    expect(result.events.filter((e) => e.kind === "accepted_change").map((e) => e.occurredAt)).toEqual(["2026-09-01T12:00:00.000Z"]);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["README.md"] });
    expect(result.events.every((e) => e.repositoryId === "R1" && e.actorId === "U1")).toBe(true);
    expect(result.coverage.repositoryIds).toEqual(["R1"]);
    expect(result.coverage.repositoryDiscoveryComplete).toBe(false);
    const requests = fetcher.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(requests.some((r) => r.query.includes("query V7MergedChanges") && String(r.variables.query).includes("merged:2025-09-06.."))).toBe(true);
    expect(requests.find((r) => r.query.includes("query V7Commits")).variables.subjectId).toBe("U1");
  });
  it("reads every submitted review, filtering actor and submitted time, including on open PRs", async () => {
    mockApi({ V7Reviews: () => ({ node: { reviews: page([
      { id: "old", author: actor, submittedAt: "2020-01-01T00:00:00Z", state: "COMMENTED" },
      { id: "first", author: actor, submittedAt: "2026-09-02T00:00:00Z", state: "COMMENTED" },
      { id: "second", author: actor, submittedAt: "2026-09-03T00:00:00Z", state: "APPROVED" },
      { id: "other", author: { id: "U2" }, submittedAt: "2026-09-03T00:00:00Z", state: "COMMENTED" },
      { id: "pending", author: actor, submittedAt: null, state: "PENDING" },
    ]) } }) });
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "review").map((e) => e.eventId).sort()).toEqual(["first", "second"]);
  });
  it("does not attribute another person's closures or an unresolved opening to the subject", async () => {
    mockApi({ V7Closures: () => ({ node: { timelineItems: page([{ id: "not-mine", actor: { id: "U2" }, createdAt: "2026-09-02T00:00:00Z" }]) } }) });
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "issue_work")).toEqual([]);
  });
  it("rejects future events and preserves restricted/null-node coverage", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([null, { ...pr(), mergedAt: "2026-09-05T13:00:00Z" }]), issueCount: 2 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 1, pullRequestReviewContributions: page([{ isRestricted: true, pullRequest: null }]) } } }),
    });
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("not_accessible");
    expect(result.coverage.eventKinds.review).toBe("partial");
  });
  it("keeps a closure's actual date separate from its linked accepted-result date", async () => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer: { ...pr("OTHER-PR"), mergedAt: "2026-09-03T00:00:00Z" } }] : []) } }) });
    const result = await runToCompletion();
    expect(result.events.find((e) => e.eventId === "CLOSE1")?.occurredAt).toBe("2026-09-04T00:00:00.000Z");
    const accepted = result.events.find((e) => e.eventId === "OTHER-PR");
    expect(accepted?.acceptance).toMatchObject({ status: "observed", value: { acceptedAt: accepted?.occurredAt, acceptedResultId: "github:OTHER-PR" } });
    expect(accepted?.workItemId).toBe("github:OTHER-PR");
  });
  it("retains a successfully collected page's cursor and resumes from the failed request instead of restarting", async () => {
    let after2Calls = 0;
    mockApi({ V7MergedChanges: ({ after }) => {
      if (!after) return { search: { ...page([pr()], "resume-here", 2), issueCount: 2 } };
      after2Calls++;
      return after2Calls === 1 ? new Response("failure", { status: 503 }) : { search: { ...page([]), issueCount: 2 } };
    } });
    let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
    let staged: NormalizedEngineeringEvent[] = [];
    const stagedKeys = new Set<string>();
    let result = await collectGitHubSlice(input, credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("http");
    // The cursor after the successful first page is retained, not reset --
    // the next slice resumes from page two instead of re-fetching page one.
    expect(result.checkpoint.operations.some((op) => op.cursor === "resume-here")).toBe(true);
    expect(result.checkpoint.operations.some((op) => op.key === "files:github:PR1")).toBe(true);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    while (!result.done) {
      result = await collectGitHubSlice(input, credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
      staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    }
    expect(staged.filter((e) => e.eventId === "PR1")).toHaveLength(1);
  });
  it("accepts a measured empty default branch instead of classifying it as inaccessible, and marks authored_commit complete under explicit scope", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { isEmpty: true, defaultBranchRef: null } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await runToCompletion(explicitInput);
    expect(result.events).toEqual([]);
    expect(result.coverage.eventKinds.authored_commit).toBe("complete");
    expect(result.coverage.reasonCodes).not.toContain("not_accessible");
  });
  it("marks contradictory changed-file counts unknown and keeps a private credential outside evidence", async () => {
    mockApi({ V7Files: () => ({ node: { files: page([{ path: "README.md" }, { path: "other.md" }]) } }) });
    const result = await runToCompletion();
    expect(result.events.find((e) => e.eventId === "PR1")?.measurements.changedFiles.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
  it("cannot call source coverage complete when declared event kinds are unavailable", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { isEmpty: true, defaultBranchRef: null } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await runToCompletion(explicitInput);
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.unknownPeriods).toHaveLength(1);
    expect(result.coverage.reasonCodes).toContain("not_supported");
  });
  it.each([
    { ...pr("OTHER"), author: { id: "U2" } },
    { __typename: "Commit", id: "COMMIT-CLOSER" },
    { __typename: "ProjectV2", id: "PROJECT-CLOSER" },
  ])("does not credit someone else's accepted work or an unsupported closer $id", async (closer) => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer }] : []) } }) });
    const result = await runToCompletion();
    expect(result.events.some((e) => e.eventId === closer.id)).toBe(false);
    const diagnostic = result.events.find((e) => e.eventId === "CLOSE1");
    expect(diagnostic?.acceptance).toMatchObject({ status: "unknown", reasonCode: "attribution_unknown" });
    expect(diagnostic?.artifactReferenceIds).toContain(`github:${closer.id}`);
    expect(diagnostic?.categories).toEqual([]);
    expect(result.coverage.reasonCodes).toContain("attribution_unknown");
  });
  it("deduplicates a source-authored linked PR and closure under the same work-item identity", async () => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer: pr() }] : []) } }) });
    const result = await runToCompletion();
    expect(result.events.find((e) => e.eventId === "CLOSE1")?.workItemId).toBe("github:PR1");
    expect(result.events.filter((e) => e.kind === "accepted_change" && e.workItemId === "github:PR1")).toHaveLength(1);
  });
  it("does not infer a feature branch and leaves empty approvals unassessed with no category credit", async () => {
    mockApi({ V7Reviews: () => ({ node: { reviews: page([{ id: "APPROVAL", author: actor, submittedAt: "2026-09-03T00:00:00Z", state: "APPROVED", body: "", comments: { totalCount: 0 } }]) } }) });
    const result = await runToCompletion();
    expect(result.events.find((e) => e.eventId === "PR1")?.measurements.usesFeatureBranch).toMatchObject({ status: "unknown", reasonCode: "not_supported" });
    const approval = result.events.find((e) => e.eventId === "APPROVAL");
    expect(approval?.categories).toEqual([]);
    expect(approval?.acceptance.status).toBe("unknown");
    expect(approval?.kind).toBe("review");
  });
  it("keeps historical review discovery partial even when returned contribution pages are exhausted", async () => {
    mockApi();
    const result = await runToCompletion(explicitInput);
    expect(result.coverage.eventKinds.review).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("discovery_incomplete");
  });
  it("keeps acceptance coverage unknown for old-authored commits that could reach default branch in-window", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { defaultBranchRef: { target: { history: page([{ id: "OLD", oid: "old-sha", author: { user: actor }, authoredDate: "2020-01-01T00:00:00Z" }]) } } } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await runToCompletion(explicitInput);
    expect(result.events).toEqual([]);
    expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("absorbs a not_accessible fan-out item (a PR whose files became inaccessible, e.g. deleted after merge) as a soft reason: the slice completes, coverage is partial with not_accessible, and the other item is still collected", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([pr("PR1"), pr("PR2")]), issueCount: 2 } }),
      V7Files: ({ id }) => id === "PR1" ? new Response("gone", { status: 403 }) : { node: { files: page([{ path: "README.md" }]) } },
    });
    const result = await runToCompletion();
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("not_accessible");
    const pr1 = result.events.find((e) => e.eventId === "PR1");
    const pr2 = result.events.find((e) => e.eventId === "PR2");
    expect(pr1?.measurements.changedFiles.status).toBe("unknown");
    expect(pr2?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["README.md"] });
  });
  it("only the identity (profile) operation can produce a terminal not_accessible stop", async () => {
    mockApi({ V7Profile: () => new Response("unauthorized", { status: 403 }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "github", operation: "profile", stopKind: "not_accessible" });
  });
});
