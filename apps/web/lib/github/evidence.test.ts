import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { fetchGitHubEvidence } from "./evidence";

vi.mock("@/lib/env", () => ({ getGithubToken: () => undefined }));
const window = createScoringWindow("2026-09-05T12:00:00Z");
const repo = { id: "R1", nameWithOwner: "external/project" };
const actor = { id: "U1", login: "alice" };
const page = (nodes: unknown[], next: string | null = null, totalCount = nodes.length) => ({ nodes, totalCount, pageInfo: { hasNextPage: next !== null, endCursor: next } });
const pr = (id = "PR1") => ({ __typename: "PullRequest", id, repository: repo, author: actor, merged: true, mergedAt: "2026-09-01T12:00:00Z", createdAt: "2020-01-01T00:00:00Z", headRefOid: "revision", body: "Problem and solution", headRefName: "feature", baseRefName: "main", additions: 1, deletions: 0, changedFiles: 1, closingIssuesReferences: { totalCount: 0 } });
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

describe("GitHub v7 dated evidence adapter", () => {
  it("uses subject event identities and dates, never calendar counts or teammate history", async () => {
    const fetcher = mockApi();
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.filter((e) => e.kind === "authored_commit").map((e) => e.eventId)).toEqual(["C1"]);
    expect(result?.events.filter((e) => e.kind === "accepted_change").map((e) => e.occurredAt)).toEqual(["2026-09-01T12:00:00.000Z"]);
    expect(result?.events.filter((e) => e.kind === "issue_work").map((e) => e.eventId)).toEqual(["CLOSE1"]);
    expect(result?.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["README.md"] });
    expect(result?.events.every((e) => e.repositoryId === "R1" && e.actorId === "U1")).toBe(true);
    expect(result?.coverage.repositoryIds).toEqual(["R1"]);
    expect(result?.coverage.repositoryDiscoveryComplete).toBe(false);
    const requests = fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(requests.find((r) => r.query.includes("query V7MergedChanges")).variables.query).toContain("merged:2025-09-06..2026-09-05");
    expect(requests.find((r) => r.query.includes("query V7Commits")).variables.subjectId).toBe("U1");
  });
  it("reads every submitted review, including on open PRs, filtering actor and submitted time", async () => {
    mockApi({ V7Reviews: () => ({ node: { reviews: page([
      { id: "old", author: actor, submittedAt: "2020-01-01T00:00:00Z", state: "COMMENTED" },
      { id: "first", author: actor, submittedAt: "2026-09-02T00:00:00Z", state: "COMMENTED" },
      { id: "second", author: actor, submittedAt: "2026-09-03T00:00:00Z", state: "APPROVED" },
      { id: "other", author: { id: "U2" }, submittedAt: "2026-09-03T00:00:00Z", state: "COMMENTED" },
      { id: "pending", author: actor, submittedAt: null, state: "PENDING" },
    ]) } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.filter((e) => e.kind === "review").map((e) => e.eventId)).toEqual(["first", "second"]);
  });
  it("does not attribute another person's closures or an unresolved opening to the subject", async () => {
    mockApi({ V7Closures: () => ({ node: { timelineItems: page([{ id: "not-mine", actor: { id: "U2" }, createdAt: "2026-09-02T00:00:00Z" }]) } }) });
    expect((await fetchGitHubEvidence("alice", window))?.events.filter((e) => e.kind === "issue_work")).toEqual([]);
  });
  it("paginates past 100 changes and files, retaining a real complete file list", async () => {
    mockApi({
      V7MergedChanges: ({ after }) => ({ search: { ...page(after ? [{ ...pr("last"), changedFiles: 2 }] : Array.from({ length: 100 }, (_, i) => ({ ...pr(`PR${i}`), changedFiles: 2 })), after ? null : "next", 101), issueCount: 101 } }),
      V7Files: ({ after }) => ({ node: { files: page(after ? [{ path: "docs/two.md" }] : [{ path: "README.md" }], after ? null : "files-next", 2) } }),
    });
    const result = await fetchGitHubEvidence("alice", window, undefined, { maxRequests: 250 });
    expect(result?.events.filter((e) => e.kind === "accepted_change")).toHaveLength(101);
    expect(result?.events.find((e) => e.eventId === "last")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["README.md", "docs/two.md"] });
  });
  it("keeps observations but marks search caps, budget exhaustion and failed file pages incomplete", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([pr()], "next", 1500), issueCount: 1500 } }),
      V7Files: () => new Response("rate limited", { status: 429 }),
    });
    const result = await fetchGitHubEvidence("alice", window, undefined, { maxRequests: 6 });
    expect(result?.coverage.status).toBe("partial");
    expect(result?.progress.some((p) => !p.complete)).toBe(true);
    expect(result?.requestCount).toBeLessThanOrEqual(6);
    expect(result?.events.find((e) => e.eventId === "PR1")?.measurements.changedFiles.status).toBe("unknown");
  });
  it("rejects future events and preserves restricted/null-node coverage", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([null, { ...pr(), mergedAt: "2026-09-05T13:00:00Z" }]), issueCount: 2 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 1, pullRequestReviewContributions: page([{ isRestricted: true, pullRequest: null }]) } } }),
    });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result?.coverage.reasonCodes).toContain("not_accessible");
    expect(result?.coverage.eventKinds.review).toBe("partial");
  });
  it("keeps a closure's actual date separate from its linked accepted-result date", async () => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer: { ...pr("OTHER-PR"), mergedAt: "2026-09-03T00:00:00Z" } }] : []) } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.find((e) => e.eventId === "CLOSE1")?.occurredAt).toBe("2026-09-04T00:00:00.000Z");
    const accepted = result?.events.find((e) => e.eventId === "OTHER-PR");
    expect(accepted?.acceptance).toMatchObject({ status: "observed", value: { acceptedAt: accepted?.occurredAt, acceptedResultId: "github:OTHER-PR" } });
    expect(accepted?.workItemId).toBe("github:OTHER-PR");
  });
  it("retains successful pages and replay cursor when the next request fails", async () => {
    mockApi({ V7MergedChanges: ({ after }) => after ? new Response("failure", { status: 503 }) : ({ search: { ...page([pr()], "resume-here", 2), issueCount: 2 } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.some((e) => e.eventId === "PR1")).toBe(true);
    expect(result?.progress.find((p) => p.operation === "merged")).toMatchObject({ complete: false, nextCursor: "resume-here", collectedNodes: 1 });
  });
  it("accepts a measured empty default branch instead of classifying it as inaccessible", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { isEmpty: true, defaultBranchRef: null } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await fetchGitHubEvidence("alice", window, undefined, { repositoryIds: ["R1"] });
    expect(result?.events).toEqual([]);
    expect(result?.coverage.eventKinds.authored_commit).toBe("complete");
    expect(result?.coverage.reasonCodes).not.toContain("not_accessible");
  });
  it("does not call partial GraphQL data complete or discard its usable events", async () => {
    mockApi({ V7MergedChanges: () => new Response(JSON.stringify({ data: { search: { ...page([pr()]), issueCount: 1 } }, errors: [{ message: "private upstream detail" }] })) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.some((e) => e.eventId === "PR1")).toBe(true);
    expect(result?.progress.find((p) => p.operation === "merged")?.complete).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private upstream detail");
  });
  it("marks contradictory changed-file counts unknown and keeps private credentials outside evidence", async () => {
    const fetcher = mockApi({ V7Files: () => ({ node: { files: page([{ path: "README.md" }, { path: "other.md" }]) } }) });
    const result = await fetchGitHubEvidence("alice", window, " private-token ");
    expect(result?.events.find((e) => e.eventId === "PR1")?.measurements.changedFiles.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer private-token" });
  });
  it("replays the incoming cursor for a non-final page containing GraphQL errors", async () => {
    mockApi({ V7MergedChanges: ({ after }) => after ? new Response(JSON.stringify({ data: { search: { ...page([pr("PR2")], "must-not-skip-to-here", 3), issueCount: 3 } }, errors: [{ message: "partial" }] })) : ({ search: { ...page([pr()], "replay-this-page", 3), issueCount: 3 } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.progress.find((p) => p.operation === "merged")).toMatchObject({ complete: false, nextCursor: "replay-this-page", collectedNodes: 2 });
  });
  it("cannot call source coverage complete when declared event kinds are unavailable", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { isEmpty: true, defaultBranchRef: null } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await fetchGitHubEvidence("alice", window, undefined, { repositoryIds: ["R1"] });
    expect(result?.coverage.status).toBe("partial");
    expect(result?.coverage.unknownPeriods).toHaveLength(1);
    expect(result?.coverage.reasonCodes).toContain("not_supported");
  });
  it.each([
    { ...pr("OTHER"), author: { id: "U2" } },
    { __typename: "Commit", id: "COMMIT-CLOSER" },
    { __typename: "ProjectV2", id: "PROJECT-CLOSER" },
  ])("does not credit someone else's accepted work or unsupported closer $id", async (closer) => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer }] : []) } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.some((e) => e.eventId === closer.id)).toBe(false);
    const diagnostic = result?.events.find((e) => e.eventId === "CLOSE1");
    expect(diagnostic?.acceptance).toMatchObject({ status: "unknown", reasonCode: "attribution_unknown" });
    expect(diagnostic?.artifactReferenceIds).toContain(`github:${closer.id}`);
    expect(diagnostic?.categories).toEqual([]);
    expect(result?.coverage.reasonCodes).toContain("attribution_unknown");
  });
  it("deduplicates a source-authored linked PR and closure under the same work-item identity", async () => {
    mockApi({ V7Closures: ({ id }) => ({ node: { timelineItems: page(id === "I1" ? [{ id: "CLOSE1", actor, createdAt: "2026-09-04T00:00:00Z", closer: pr() }] : []) } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.find((e) => e.eventId === "CLOSE1")?.workItemId).toBe("github:PR1");
    expect(result?.events.filter((e) => e.kind === "accepted_change" && e.workItemId === "github:PR1")).toHaveLength(1);
  });
  it("does not infer a feature branch or substantive practice from different branch names and empty approvals", async () => {
    mockApi({ V7Reviews: () => ({ node: { reviews: page([{ id: "APPROVAL", author: actor, submittedAt: "2026-09-03T00:00:00Z", state: "APPROVED", body: "", comments: { totalCount: 0 } }]) } }) });
    const result = await fetchGitHubEvidence("alice", window);
    expect(result?.events.find((e) => e.eventId === "PR1")?.measurements.usesFeatureBranch).toMatchObject({ status: "unknown", reasonCode: "not_supported" });
    const approval = result?.events.find((e) => e.eventId === "APPROVAL");
    expect(approval?.categories).toEqual([]);
    expect(approval?.acceptance.status).toBe("unknown");
    expect(approval?.kind).toBe("review");
  });
  it("keeps historical review discovery partial even when returned contribution pages are exhausted", async () => {
    mockApi();
    const result = await fetchGitHubEvidence("alice", window, undefined, { repositoryIds: ["R1"] });
    expect(result?.coverage.eventKinds.review).toBe("partial");
    expect(result?.coverage.reasonCodes).toContain("discovery_incomplete");
  });
  it("keeps acceptance coverage unknown for old-authored commits that could reach default branch in-window", async () => {
    mockApi({
      V7MergedChanges: () => ({ search: { ...page([]), issueCount: 0 } }),
      V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
      V7Commits: () => ({ node: { defaultBranchRef: { target: { history: page([{ id: "OLD", oid: "old-sha", author: { user: actor }, authoredDate: "2020-01-01T00:00:00Z" }]) } } } }),
      V7Issues: () => ({ node: { issues: page([]) } }),
    });
    const result = await fetchGitHubEvidence("alice", window, undefined, { repositoryIds: ["R1"] });
    expect(result?.events).toEqual([]);
    expect(result?.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result?.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
});
