import { afterEach, expect, it, vi } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitHubSlice } from "../github/evidence";
import { collectBitbucketSlice } from "./evidence";

/**
 * Ported from evidence.test.ts's "reconciles actual GitHub and Bitbucket
 * adapters..." (#1335 phase 3 part B/C): the two collector *slice* engines
 * must still produce events `aggregateEngineeringEvidence` treats as
 * equivalent once a verified repository alias and work-item equivalence are
 * supplied, the same proof the single-run adapters gave.
 */
const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const U = "{11111111-1111-1111-1111-111111111111}";
const W = "{22222222-2222-2222-2222-222222222222}";
const R = "{33333333-3333-3333-3333-333333333333}";
const subject = { uuid: U, account_id: "account-1" };
const merge = () => ({ update: { state: "MERGED", date, description: "Reason", source: { commit: { hash: "aaaaaaaaaaaa" } }, destination: { commit: { hash: "bbbbbbbbbbbb" } } } });
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers });
const page = (values: unknown[]) => json({ values });
afterEach(() => vi.unstubAllGlobals());

const credential = { token: "fixture-token" };
function bitbucketInput(): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "juan" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function githubInput(): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window, scope: { discovery: "explicit_repositories", repositoryIds: ["R1"], eventKinds: [] } };
}
async function runBitbucket() {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT; let staged: NormalizedEngineeringEvent[] = [];
  for (;;) {
    const result = await collectBitbucketSlice(bitbucketInput(), credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, staged);
    staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
  }
}
async function runGitHub() {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT; let staged: NormalizedEngineeringEvent[] = [];
  for (;;) {
    const result = await collectGitHubSlice(githubInput(), credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, staged);
    staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
  }
}

it("reconciles the GitHub and Bitbucket slice engines through verified project/work mappings, the same as the single-run adapters", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/2.0", "");
    if (path === "/user") return json({ ...subject, display_name: "Alice" });
    if (path === "/user/workspaces") return page([{ workspace: { uuid: W } }]);
    if (path === `/repositories/${W}`) return page([{ uuid: R, workspace: { uuid: W }, full_name: "team/project" }]);
    if (path.endsWith("/commits")) return page([{ hash: "dddddddddddd", date, author: { user: subject } }]);
    if (path.endsWith("/pullrequests")) return page([{ id: 1, author: subject, state: "MERGED", created_on: "2024-01-01T00:00:00Z", description: "Reason" }]);
    if (path.endsWith("/1/activity")) return page([merge()]);
    if (path.endsWith("/diffstat")) return json({}, 302, { location: `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(W)}/${encodeURIComponent(R)}/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb` });
    if (path.includes("/diffstat/")) return page([{ status: "modified", lines_added: 2, lines_removed: 1, old: { path: "docs/a.md" }, new: { path: "docs/a.md" } }]);
    throw new Error(`Unexpected path ${path}`);
  }));
  const bb = await runBitbucket();

  const githubActor = { id: "U1", login: "alice" };
  const githubRepo = { id: "R1", nameWithOwner: "mirror/project" };
  const connection = (nodes: unknown[]) => ({ nodes, totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null } });
  const githubPr = { id: "PR1", author: githubActor, repository: githubRepo, merged: true, mergedAt: date, createdAt: "2024-01-01T00:00:00Z", headRefOid: "aaaaaaaaaaaa", body: "Reason", additions: 2, deletions: 1, changedFiles: 1, closingIssuesReferences: { totalCount: 0 } };
  const responses: Record<string, unknown> = {
    V7Profile: { user: githubActor },
    V7MergedChanges: { search: { ...connection([githubPr]), issueCount: 1 } },
    V7Files: { node: { files: connection([{ path: "docs/a.md" }]) } },
    V7ReviewDiscovery: { user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: connection([]) } } },
    V7Commits: { node: { defaultBranchRef: { target: { history: connection([{ id: "C1", oid: "dddddddddddd", authoredDate: date, author: { user: githubActor }, additions: 2, deletions: 1 }]) } } } },
    V7Issues: { node: { issues: connection([]) } },
  };
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const operation = /query (\w+)/.exec(JSON.parse(String((init as RequestInit).body)).query)?.[1] ?? "";
    if (!(operation in responses)) throw new Error(`Unexpected GitHub operation ${operation}`);
    return json({ data: responses[operation] });
  }));
  const gh = await runGitHub();

  const ghAccepted = gh.events.find((e) => e.kind === "accepted_change")!;
  const bbAccepted = bb.events.find((e) => e.kind === "accepted_change")!;
  const ghCommit = gh.events.find((e) => e.kind === "authored_commit")!;
  const bbCommit = bb.events.find((e) => e.kind === "authored_commit")!;
  expect(ghAccepted).toBeDefined(); expect(bbAccepted).toBeDefined();
  expect(ghCommit).toBeDefined(); expect(bbCommit).toBeDefined();

  const repositoryAliases: EngineeringEvidenceInput["repositoryAliases"] = [{
    repositories: [ghAccepted, bbAccepted], canonicalProjectId: "verified-mirror-project",
    verifiedAt: window.referenceTime, evidenceReferenceIds: ["fixture:verified-project-mirror"],
  }];
  function input(events: readonly NormalizedEngineeringEvent[], sources: readonly SourceCoverage[], selected: NormalizedEngineeringEvent): EngineeringEvidenceInput {
    return {
      schemaVersion: "v7", window, events, scope: { sources, excludedSources: [], ledgerRevisionIds: [] }, assessments: [], repositoryAliases,
      equivalentWorkItems: [
        { workItemIds: [ghAccepted.workItemId, bbAccepted.workItemId], canonicalWorkItemId: "verified-mirror-work", acceptedEventId: selected.eventId, evidenceReferenceIds: ["fixture:verified-accepted-work-equivalence"] },
        { workItemIds: [ghCommit.workItemId, bbCommit.workItemId], canonicalWorkItemId: "verified-mirror-commit", acceptedEventId: ghCommit.eventId, evidenceReferenceIds: ["fixture:verified-identical-commit"] },
      ],
    };
  }
  const github = aggregateEngineeringEvidence(input(gh.events, [gh.coverage], ghAccepted));
  const bitbucket = aggregateEngineeringEvidence(input(bb.events, [bb.coverage], bbAccepted));
  const acceptedSummary = (value: typeof github) => value.acceptedWork.map(({ workItemId, canonicalProjectId, acceptedAt }) => ({ workItemId, canonicalProjectId, acceptedAt }));
  expect(acceptedSummary(bitbucket)).toEqual(acceptedSummary(github));
  expect(acceptedSummary(github)).toEqual([{ workItemId: "verified-mirror-work", canonicalProjectId: "verified-mirror-project", acceptedAt: date.replace("Z", ".000Z") }]);
  for (const field of ["changedFiles", "additions", "deletions", "leadTimeHours", "hasDescription", "usesFeatureBranch"] as const) {
    expect(bbAccepted.measurements[field]).toEqual(ghAccepted.measurements[field]);
  }
  expect(github.diagnostics.authoredCommits).toBe(1);
  // A real, documented capability asymmetry, not a bug: Bitbucket commits
  // carry no per-commit line stats in this collector, unlike GitHub's.
  expect(bbCommit.measurements.additions.status).toBe("unknown");
  expect(ghCommit.measurements.additions.status).toBe("observed");
  expect(ghAccepted.subjectId).not.toBe(bbAccepted.subjectId);
  expect(ghAccepted.provider).not.toBe(bbAccepted.provider);
  expect(bb.coverage.eventKinds.issue_work).toBe("unavailable");
  expect(gh.coverage.eventKinds.issue_work).not.toBe("unavailable");
  const combined = aggregateEngineeringEvidence(input([...gh.events, ...bb.events], [gh.coverage, bb.coverage], ghAccepted));
  expect(acceptedSummary(combined)).toEqual(acceptedSummary(github));
  expect(combined.diagnostics.authoredCommits).toBe(1);
  expect(combined.acceptedWork[0]?.evidenceReferenceIds).toEqual(expect.arrayContaining([...ghAccepted.artifactReferenceIds, ...bbAccepted.artifactReferenceIds]));
});
