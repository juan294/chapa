import { afterEach, expect, it, vi } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow, engineeringEventKey, type EngineeringEvidenceInput, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitHubSlice } from "../github/evidence";
import { collectCodebergSlice } from "./evidence";

/**
 * Ported from evidence.test.ts's "reconciles actual GitHub and Codeberg
 * adapters..." (#1335 phase 3 part B/C) -- see the header comment in
 * ../bitbucket/evidence-reconciliation.test.ts.
 */
const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const actor = { id: 7, login: "alice" };
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
afterEach(() => vi.unstubAllGlobals());

const credential = { token: "token" };
function codebergInput(): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "codeberg", host: "codeberg.org", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function githubInput(): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "github", host: "github.com", login: "alice" }, window, scope: { discovery: "explicit_repositories", repositoryIds: ["R1"], eventKinds: [] } };
}
async function runCodeberg() {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT; let staged: NormalizedEngineeringEvent[] = []; const stagedKeys = new Set<string>();
  for (;;) {
    const result = await collectCodebergSlice(codebergInput(), credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
  }
}
async function runGitHub() {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT; let staged: NormalizedEngineeringEvent[] = []; const stagedKeys = new Set<string>();
  for (;;) {
    const result = await collectGitHubSlice(githubInput(), credential, checkpoint, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events]; checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
  }
}

it("reconciles the GitHub and Codeberg slice engines through verified project/work mappings, the same as the single-run adapters", async () => {
  const pr = { id: 1001, number: 1, user: actor, merged: true, merged_at: date, created_at: "2024-01-01T00:00:00Z", head: { sha: "aaaaaaaaaaaa" }, merge_commit_sha: "cccccccccccc", body: "Reason", changed_files: 1, additions: 2, deletions: 1 };
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/api/v1", "");
    if (path === "/user") return json(actor);
    if (path === "/users/alice/repos" || path === "/user/repos") return json([{ id: 10, full_name: "team/project10", has_issues: true }]);
    if (path === "/users/alice/activities/feeds") return json([]);
    if (path.endsWith("/commits")) return json([]);
    if (path.endsWith("/pulls")) return json([pr]);
    if (path.includes("/git/refs/pull/")) return json([{ ref: "refs/pull/1/head", object: { sha: "aaaaaaaaaaaa" } }]);
    if (path.endsWith("/files")) return json([{ filename: "docs/a.md", status: "modified", additions: 2, deletions: 1 }], 200, { "x-total-count": "1" });
    if (path.endsWith("/reviews")) return json([]);
    if (path.endsWith("/issues")) return json([]);
    throw new Error(`Unexpected endpoint ${path}`);
  }));
  const cb = await runCodeberg();

  const ghActor = { id: "U1", login: "alice" };
  const connection = (nodes: unknown[]) => ({ nodes, totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null } });
  const responses: Record<string, unknown> = {
    V7Profile: { user: ghActor },
    V7MergedChanges: { search: { ...connection([{ id: "PR1", author: ghActor, repository: { id: "R1" }, merged: true, mergedAt: date, createdAt: pr.created_at, headRefOid: "aaaaaaaaaaaa", body: "Reason", changedFiles: 1, additions: 2, deletions: 1, closingIssuesReferences: { totalCount: 0 } }]), issueCount: 1 } },
    V7Files: { node: { files: connection([{ path: "docs/a.md" }]) } },
    V7ReviewDiscovery: { user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: connection([]) } } },
    V7Commits: { node: { isEmpty: true, defaultBranchRef: null } },
    V7Issues: { node: { issues: connection([]) } },
  };
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const operation = /query (\w+)/.exec(JSON.parse(String((init as RequestInit).body)).query)?.[1] ?? "";
    if (!(operation in responses)) throw new Error("Unexpected GraphQL operation");
    return json({ data: responses[operation] });
  }));
  const gh = await runGitHub();

  const a = gh.events.find((e) => e.kind === "accepted_change")!;
  const b = cb.events.find((e) => e.kind === "accepted_change")!;
  expect(a).toBeDefined(); expect(b).toBeDefined();
  function input(events: NormalizedEngineeringEvent[], sources: EngineeringEvidenceInput["scope"]["sources"], selected: string): EngineeringEvidenceInput {
    return {
      schemaVersion: "v7", window, events, scope: { sources, excludedSources: [], ledgerRevisionIds: [] }, assessments: [],
      repositoryAliases: [{ repositories: [a, b], canonicalProjectId: "verified-project", verifiedAt: window.referenceTime, evidenceReferenceIds: ["fixture:mirror-proof"] }],
      equivalentWorkItems: [{ workItemIds: [a.workItemId, b.workItemId], canonicalWorkItemId: "verified-work", acceptedEventId: selected, evidenceReferenceIds: ["fixture:work-proof"] }],
    };
  }
  const github = aggregateEngineeringEvidence(input(gh.events, [gh.coverage], a.eventId));
  const codeberg = aggregateEngineeringEvidence(input(cb.events, [cb.coverage], b.eventId));
  const accepted = (value: typeof github) => value.acceptedWork.map(({ workItemId, canonicalProjectId, acceptedAt }) => ({ workItemId, canonicalProjectId, acceptedAt }));
  expect(accepted(codeberg)).toEqual(accepted(github)); expect(accepted(codeberg)).toHaveLength(1);
  for (const field of ["changedFiles", "additions", "deletions", "leadTimeHours", "hasDescription", "usesFeatureBranch"] as const) expect(b.measurements[field]).toEqual(a.measurements[field]);
  expect(a.subjectId).not.toBe(b.subjectId); expect(a.provider).not.toBe(b.provider);
  const combined = aggregateEngineeringEvidence(input([...gh.events, ...cb.events], [gh.coverage, cb.coverage], a.eventId));
  expect(accepted(combined)).toEqual(accepted(github));
  expect(combined.acceptedWork[0]?.evidenceReferenceIds).toEqual(expect.arrayContaining([...a.artifactReferenceIds, ...b.artifactReferenceIds]));
});
