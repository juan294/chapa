import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitHubSlice, githubMergedSearchRanges } from "./evidence";

vi.mock("@/lib/env", () => ({ getGithubToken: () => undefined }));

const window = createScoringWindow("2026-09-05T12:00:00Z");
const actor = { id: "U1", login: "alice" };
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
    V7Repositories: () => ({ user: { repositories: page([]) } }),
    V7ContributedRepositories: () => ({ user: { repositoriesContributedTo: page([]) } }),
    V7ReviewDiscovery: () => ({ user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: page([]) } } }),
    V7Issues: () => ({ node: { issues: page([]) } }),
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

async function runToCompletion(maxRequests: number, initial: CollectorCheckpoint = EMPTY_CHECKPOINT) {
  let checkpoint = initial;
  let staged: NormalizedEngineeringEvent[] = [];
  const stagedKeys = new Set<string>();
  let slices = 0;
  for (;;) {
    slices++;
    if (slices > 5000) throw new Error("runaway slice loop");
    const result = await collectGitHubSlice(input, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 120_000 }, stagedKeys);
    for (const event of result.events) {
      const key = engineeringEventKey(event);
      if (stagedKeys.has(key)) throw new Error(`Duplicate event key across slices: ${key}`);
      stagedKeys.add(key);
    }
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, slices, coverage: result.coverage };
    if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
      throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
    }
  }
}

describe("collectGitHubSlice", () => {
  it("converges across many bounded slices to the same event set as one unbounded run", async () => {
    const REPO_COUNT = 36;
    const PRS_PER_REPO = 50; // 1,800 total
    const prs: { id: string; repositoryId: string; mergedAt: string }[] = [];
    for (let r = 0; r < REPO_COUNT; r++) {
      for (let p = 0; p < PRS_PER_REPO; p++) {
        const globalIndex = r * PRS_PER_REPO + p;
        const date = new Date(Date.parse(window.startInclusive) + (globalIndex % 365) * 86_400_000);
        prs.push({ id: `PR${globalIndex}`, repositoryId: `R${r}`, mergedAt: date.toISOString() });
      }
    }
    const mergedHandler: Handler = ({ query, after }) => {
      const match = /merged:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/.exec(String(query));
      const [, start, end] = match!;
      const matches = prs.filter((pr) => { const d = pr.mergedAt.slice(0, 10); return d >= start! && d <= end!; });
      const offset = after ? Number(after) : 0;
      const slice = matches.slice(offset, offset + 100);
      const nextOffset = offset + 100;
      const hasNextPage = nextOffset < matches.length;
      return { search: { issueCount: matches.length, pageInfo: { hasNextPage, endCursor: hasNextPage ? String(nextOffset) : null }, nodes: slice.map((pr) => ({
        __typename: "PullRequest", id: pr.id, repository: { id: pr.repositoryId, nameWithOwner: pr.repositoryId }, author: actor,
        merged: true, mergedAt: pr.mergedAt, createdAt: "2020-01-01T00:00:00.000Z", headRefOid: `sha-${pr.id}`, body: "desc",
        headRefName: "feature", baseRefName: "main", additions: 1, deletions: 0, changedFiles: 1, closingIssuesReferences: { totalCount: 0 },
      })) } };
    };
    const filesHandler: Handler = ({ id }) => ({ node: { files: page([{ path: `file-${id as string}.md` }]) } });
    const commitsSince: unknown[] = [];
    const commitsHandler: Handler = ({ id, since }) => { commitsSince.push(since); return { node: { isEmpty: false, defaultBranchRef: { target: { history: page([
      { id: `${id as string}-C1`, oid: `${id as string}-C1`, author: { user: actor }, authoredDate: "2026-01-01T00:00:00.000Z", additions: 1, deletions: 0 },
      { id: `${id as string}-C2`, oid: `${id as string}-C2`, author: { user: actor }, authoredDate: "2026-01-02T00:00:00.000Z", additions: 1, deletions: 0 },
    ]) } } } }; };
    mockApi({ V7MergedChanges: mergedHandler, V7Files: filesHandler, V7Commits: commitsHandler });

    const result = await runToCompletion(5);
    // History is bounded by committed date with a 30-day margin before the
    // window, so authored-date filtering (inWindow) still sees every commit.
    expect(commitsSince.length).toBeGreaterThan(0);
    const expectedSince = new Date(Date.parse(`${window.startInclusive.slice(0, 10)}T00:00:00.000Z`) - 30 * 86_400_000).toISOString();
    expect(new Set(commitsSince)).toEqual(new Set([expectedSince]));
    expect(result.slices).toBeGreaterThan(1);
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(1800);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(REPO_COUNT * 2);
    const acceptedIds = new Set(result.events.filter((e) => e.kind === "accepted_change").map((e) => e.eventId));
    expect(acceptedIds.size).toBe(1800);
    expect(result.coverage).not.toBeNull();
  }, 30_000);

  it("splits a merged-search range whose issueCount exceeds 1,000", async () => {
    const ranges = githubMergedSearchRanges(window);
    const target = ranges[3]!;
    const dayCount = Math.round((Date.parse(`${target.end}T00:00:00.000Z`) - Date.parse(`${target.start}T00:00:00.000Z`)) / 86_400_000) + 1;
    const prs = Array.from({ length: 1200 }, (_, i) => {
      const day = new Date(Date.parse(`${target.start}T00:00:00.000Z`) + (i % dayCount) * 86_400_000).toISOString();
      return { id: `PR${i}`, repositoryId: "R1", mergedAt: day };
    });
    const mergedHandler: Handler = ({ query, after }) => {
      const match = /merged:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/.exec(String(query));
      const [, start, end] = match!;
      const matches = prs.filter((pr) => { const d = pr.mergedAt.slice(0, 10); return d >= start! && d <= end!; });
      const offset = after ? Number(after) : 0;
      const slice = matches.slice(offset, offset + 100);
      const nextOffset = offset + 100;
      const hasNextPage = nextOffset < matches.length;
      return { search: { issueCount: matches.length, pageInfo: { hasNextPage, endCursor: hasNextPage ? String(nextOffset) : null }, nodes: slice.map((pr) => ({
        __typename: "PullRequest", id: pr.id, repository: { id: pr.repositoryId, nameWithOwner: pr.repositoryId }, author: actor,
        merged: true, mergedAt: pr.mergedAt, createdAt: "2020-01-01T00:00:00.000Z", headRefOid: `sha-${pr.id}`, body: "desc",
        headRefName: "feature", baseRefName: "main", additions: 1, deletions: 0, changedFiles: 1, closingIssuesReferences: { totalCount: 0 },
      })) } };
    };
    const filesHandler: Handler = ({ id }) => ({ node: { files: page([{ path: `file-${id as string}.md` }]) } });
    const commitsHandler: Handler = () => ({ node: { isEmpty: true, defaultBranchRef: null } });
    const fetcher = mockApi({ V7MergedChanges: mergedHandler, V7Files: filesHandler, V7Commits: commitsHandler });

    const result = await runToCompletion(50);
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(1200);

    const mergedQueries = fetcher.mock.calls
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { query: string; variables: { query?: string } })
      .filter((call) => call.query.includes("V7MergedChanges"))
      .map((call) => call.variables.query!);
    const fullRange = `merged:${target.start}..${target.end}`;
    expect(mergedQueries).not.toContain(fullRange);
    expect(mergedQueries.some((q) => q.includes(`merged:${target.start}..`) && q !== fullRange)).toBe(true);
  }, 30_000);

  it("stops with a rate-limited diagnostic and retryAfterSeconds when GraphQL rateLimit.remaining drops below the floor", async () => {
    mockApi({ V7Profile: () => ({ user: { ...actor, name: "Alice", avatarUrl: null }, rateLimit: { remaining: 5, resetAt: new Date(Date.now() + 3_600_000).toISOString(), cost: 1 } }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 100, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("rate_limited");
    expect(result.stop?.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.checkpoint.operations.find((op) => op.key === "profile")?.done).toBe(true);
  });

  it("stops on budget exhaustion, never as a source_error", async () => {
    mockApi({ V7Repositories: () => ({ user: { repositories: page([{ id: "R1", nameWithOwner: "a/b" }]) } }) });
    const result = await collectGitHubSlice(input, credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("budget");
  });
});

describe("githubMergedSearchRanges", () => {
  it("covers the whole window with contiguous monthly boundaries", () => {
    const ranges = githubMergedSearchRanges(window);
    expect(ranges[0]!.start).toBe(window.startInclusive.slice(0, 10));
    expect(ranges.at(-1)!.end).toBe(window.referenceDate);
    for (let i = 1; i < ranges.length; i++) {
      const previousEnd = new Date(`${ranges[i - 1]!.end}T00:00:00.000Z`);
      const nextStart = new Date(`${ranges[i]!.start}T00:00:00.000Z`);
      expect(nextStart.getTime() - previousEnd.getTime()).toBe(86_400_000);
    }
  });
});
