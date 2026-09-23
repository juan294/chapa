import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow, type EngineeringEvidenceInput } from "@chapa/shared";
import { fetchGitHubEvidence } from "../github/evidence";
import { fetchCodebergEvidence } from "./evidence";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const actor = { id: 7, login: "alice" };
const repo = (id = 10) => ({ id, full_name: `team/project${id}`, name: `project${id}`, owner: { login: "team" }, has_issues: true });
const pr = (number = 1, fields = {}) => ({ id: 1000 + number, number, user: actor, merged: true, merged_at: date, created_at: "2024-01-01T00:00:00Z", head: { sha: "aaaaaaaaaaaa" }, merge_commit_sha: "cccccccccccc", body: "Reason", changed_files: 1, additions: 2, deletions: 1, ...fields });
const file = { filename: "docs/a.md", status: "modified", additions: 2, deletions: 1 };
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
function api(override?: (url: URL) => Response | undefined) {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/api/v1", "");
    const custom = override?.(url); if (custom) return custom;
    if (path === "/user") return json(actor);
    if (path === "/users/alice/repos") return json([]);
    if (path === "/user/repos") return json([]);
    if (path === "/users/alice/activities/feeds") return json([{ id: 1, act_user_id: 7, act_user: actor, repo: repo(), op_type: "merge_pull_request", created: date }]);
    if (/^\/repositories\/\d+$/.test(path)) return json(repo(Number(path.split("/").at(-1))));
    if (path.endsWith("/commits")) return json([
      { sha: "dddddddddddd", author: actor, commit: { author: { date }, committer: { date: "2026-09-05T12:00:00Z" } }, stats: { additions: 2, deletions: 1 } },
      { sha: "eeeeeeeeeeee", author: { id: 8 }, commit: { author: { date } } },
    ]);
    if (path.endsWith("/pulls")) return json([pr(), pr(2, { merged: false, user: { id: 8 } })]);
    if (path.includes("/git/refs/pull/")) return json([{ ref: `refs/pull/${path.split("/").at(-2)}/head`, object: { sha: "aaaaaaaaaaaa" } }]);
    if (path.endsWith("/files")) return json([file], 200, { "x-total-count": "1" });
    if (path.endsWith("/reviews")) return json([{ id: 20, user: actor, state: "APPROVED", submitted_at: date, commit_id: "aaaaaaaaaaaa", body: "" }]);
    if (path.endsWith("/issues")) return json([{ id: 30, number: 3, user: { id: 8 }, state: "open" }]);
    if (path.endsWith("/timeline")) return json([
      { id: 40, type: "close", user: actor, created_at: date, ref_commit_sha: "cccccccccccc" },
      { id: 41, type: "close", user: { id: 8 }, created_at: date },
    ]);
    throw new Error(`Unexpected endpoint ${path}`);
  }));
}
afterEach(() => vi.unstubAllGlobals());
describe("Codeberg v7 evidence", () => {
  it("discovers contributed repos and emits actual attributable dated events", async () => {
    api(); const result = await fetchCodebergEvidence(7, "alice", "secret", window);
    expect(result.coverage.repositoryIds).toEqual(["10"]);
    expect(result.coverage.repositoryDiscoveryComplete).toBe(false);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(1);
    expect(result.events.find((e) => e.kind === "authored_commit")?.occurredAt).toBe(date.replace("Z", ".000Z"));
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.acceptance).toMatchObject({ status: "observed", value: { acceptedAt: accepted.occurredAt } });
    expect(accepted.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md"] });
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
    expect(result.events.filter((e) => e.kind === "issue_work")).toHaveLength(1);
    expect(result.events.find((e) => e.kind === "issue_work")?.acceptance.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.coverage.status).toBe("partial");
  });
  it("does not count MR or heatmap activity as authored commits", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json([]) : undefined);
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(true);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toEqual([]);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("heatmap"))).toBe(false);
  });
  it("dates reviews and closures independently of old merges and later updates", async () => {
    api((url) => {
      if (url.pathname.endsWith("/pulls")) return json([pr(1, { merged_at: "2024-01-01T00:00:00Z", updated_at: date })]);
      if (url.pathname.endsWith("/timeline")) return json([{ id: 40, type: "close", user: actor, created_at: "2024-01-01T00:00:00Z", updated_at: date }]);
    });
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    expect(result.events.some((e) => e.kind === "accepted_change" || e.kind === "issue_work")).toBe(false);
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(1);
  });
  it("never treats requested/pending/teammate/undated reviews as submitted subject reviews", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json([
      { id: 1, user: actor, state: "REQUEST_REVIEW", submitted_at: date },
      { id: 2, user: actor, state: "PENDING", submitted_at: date },
      { id: 3, user: { id: 8 }, state: "APPROVED", submitted_at: date },
      { id: 4, user: actor, state: "COMMENT", submitted_at: null },
    ]) : undefined);
    expect((await fetchCodebergEvidence(7, "alice", "token", window)).events.filter((e) => e.kind === "review")).toEqual([]);
  });
  it("traverses the 51st contributed repository within a sufficient shared budget", async () => {
    api((url) => {
      if (url.pathname.endsWith("/activities/feeds")) return url.searchParams.get("page") === "1" ? json(Array.from({ length: 50 }, (_, i) => ({ act_user_id: 7, repo: repo(i + 1) })), 200, { "x-total-count": "51" }) : json([{ act_user_id: 7, repo: repo(51) }], 200, { "x-total-count": "51" });
      if (/\/(commits|pulls|issues)$/.test(url.pathname)) return json([]);
    });
    const result = await fetchCodebergEvidence(7, "alice", "token", window, { maxRequests: 300 });
    expect(result.coverage.repositoryIds).toHaveLength(51);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("project51/commits"))).toBe(true);
  });
  it("retains prior pages and failed incoming page in nested pagination", async () => {
    api((url) => {
      if (!url.pathname.endsWith("/reviews")) return;
      return url.searchParams.get("page") === "1" ? json([{ id: 20, state: "COMMENT", user: actor, submitted_at: date }], 200, { link: `<${url.origin}${url.pathname}?page=2&limit=50>; rel="next"` }) : json({}, 429);
    });
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
    expect(result.progress.find((p) => p.path.endsWith("/reviews"))).toMatchObject({ complete: false, nextPage: 2, collectedNodes: 1 });
    expect(result.coverage.eventKinds.review).toBe("partial");
  });
  it.each([{ additions: undefined }, { deletions: -1 }, { additions: 0 }, { filename: undefined }, { truncated: true }])("retains unknown measurements for incomplete files: %j", async (fields) => {
    api((url) => url.pathname.endsWith("/files") ? json([{ ...file, ...fields }]) : undefined);
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    const event = result.events.find((e) => e.kind === "accepted_change")!;
    expect(event.measurements.changedFiles.status).toBe("unknown");
    expect(event.measurements.additions.status).toBe("unknown");
    expect(result.coverage.reasonCodes).toContain("partial_files");
  });
  it("rejects files tied to a moved head instead of the archived PR revision", async () => {
    api((url) => url.pathname.includes("/git/refs/pull/") ? json([{ ref: "refs/pull/1/head", object: { sha: "ffffffffffff" } }]) : undefined);
    expect((await fetchCodebergEvidence(7, "alice", "token", window)).events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
  });
  it("binds the accepted artifact to its merge commit rather than a later source branch head", async () => {
    api((url) => url.pathname.endsWith("/pulls") ? json([pr(1, { head: { sha: "ffffffffffff" } })]) : undefined);
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.artifactRevision).toBe("cccccccccccc");
    expect(accepted.measurements.changedFiles.status).toBe("unknown");
    expect(accepted.artifactReferenceIds).toContain("codeberg.org:repository:10:commit:cccccccccccc");
  });
  it("does not advance a malformed incoming page beyond its valid retained nodes", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json([{ id: 20, user: actor, state: "COMMENT", submitted_at: date }, null], 200, { link: `<${url.origin}${url.pathname}?page=2&limit=50>; rel="next"` }) : undefined);
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    expect(result.progress.find((p) => p.path.endsWith("/reviews"))).toMatchObject({ complete: false, nextPage: 1, collectedNodes: 1 });
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
  });
  it("keeps both rename sides in complete file observations", async () => {
    api((url) => url.pathname.endsWith("/files") ? json([{ ...file, status: "renamed", previous_filename: "src/a.ts" }]) : undefined);
    expect((await fetchCodebergEvidence(7, "alice", "token", window)).events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["src/a.ts", "docs/a.md"] });
  });
  it("keeps unavailable reviews unknown and empty approval clicks unassessed", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json({}, 403) : undefined);
    expect((await fetchCodebergEvidence(7, "alice", "token", window)).coverage.eventKinds.review).toBe("unavailable");
    api(); const result = await fetchCodebergEvidence(7, "alice", "token", window);
    for (const event of result.events.filter((e) => e.kind === "review")) { expect(event.categories).toEqual([]); expect(event.acceptance.status).toBe("unknown"); }
  });
  it("keeps first reachability unknown even if authored work predates the window", async () => {
    api((url) => {
      if (url.pathname.endsWith("/commits")) return json([{ sha: "dddddddddddd", author: actor, commit: { author: { date: "2024-01-01T00:00:00Z" } } }]);
      if (/\/(pulls|issues)$/.test(url.pathname)) return json([]);
    });
    const result = await fetchCodebergEvidence(7, "alice", "token", window, { repositoryIds: [10] });
    expect(result.events).toEqual([]); expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("applies one request budget, retaining unfinished checkpoints", async () => {
    api(); const result = await fetchCodebergEvidence(7, "alice", "token", window, { maxRequests: 5 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5); expect(result.requestCount).toBe(5);
    expect(result.progress.some((p) => !p.complete && p.nextPage !== null)).toBe(true);
    expect(result.diagnostics.some((d) => d.stopKind === "budget")).toBe(true);
  });
  it("marks a repos deadline stop as pagination_incomplete, never source_error, with a deadline diagnostic", async () => {
    vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => {
      const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/api/v1", "");
      if (path === "/users/alice/repos") {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        });
      }
      if (path === "/user") return Promise.resolve(json(actor));
      if (path === "/user/repos") return Promise.resolve(json([]));
      if (path === "/users/alice/activities/feeds") return Promise.resolve(json([]));
      throw new Error(`Unexpected endpoint ${path}`);
    }));
    const result = await fetchCodebergEvidence(7, "alice", "token", window, { timeoutMs: 50 });
    expect(result.coverage.reasonCodes).toContain("pagination_incomplete");
    expect(result.coverage.reasonCodes).not.toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "codeberg", operation: "repos", stopKind: "deadline" }));
  });
  it("keeps a review's artifact revision stable across collections despite a changed updated_at (parity with #1335 phase 1.5)", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json([{ id: 20, user: actor, state: "APPROVED", submitted_at: date, updated_at: date, commit_id: "aaaaaaaaaaaa", body: "" }]) : undefined);
    const first = await fetchCodebergEvidence(7, "alice", "token", window);
    api((url) => url.pathname.endsWith("/reviews") ? json([{ id: 20, user: actor, state: "APPROVED", submitted_at: date, updated_at: "2026-09-05T00:00:00Z", commit_id: "aaaaaaaaaaaa", body: "" }]) : undefined);
    const second = await fetchCodebergEvidence(7, "alice", "token", window);
    const revision = (result: Awaited<ReturnType<typeof fetchCodebergEvidence>>) => result.events.find((e) => e.kind === "review")?.artifactRevision;
    expect(revision(first)).toBeDefined();
    expect(revision(first)).toBe(revision(second));
  });
  it("does not follow credential redirects or foreign pagination links", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json([], 200, { link: '<https://evil.test/steal?page=2>; rel="next"' }) : undefined);
    const result = await fetchCodebergEvidence(7, "alice", "token", window);
    expect(vi.mocked(fetch).mock.calls.every(([url, options]) => new URL(String(url)).origin === "https://codeberg.org" && options?.redirect === "error")).toBe(true);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(JSON.stringify(result)).not.toContain("evil.test");
  });
  it("reconciles actual GitHub and Codeberg adapters after verified project/work mappings", async () => {
    api((url) => /\/(commits|reviews|issues)$/.test(url.pathname) ? json([]) : undefined);
    const cb = await fetchCodebergEvidence(7, "alice", "token", window);
    const connection = (nodes: unknown[]) => ({ nodes, totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null } });
    const ghActor = { id: "U1", login: "alice" };
    const responses: Record<string, unknown> = {
      V7Profile: { user: ghActor },
      V7MergedChanges: { search: { ...connection([{ id: "PR1", author: ghActor, repository: { id: "R1" }, merged: true, mergedAt: date, createdAt: pr().created_at, headRefOid: "aaaaaaaaaaaa", body: "Reason", changedFiles: 1, additions: 2, deletions: 1, closingIssuesReferences: { totalCount: 0 } }]), issueCount: 1 } },
      V7Files: { node: { files: connection([{ path: "docs/a.md" }]) } },
      V7ReviewDiscovery: { user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: connection([]) } } },
      V7Commits: { node: { isEmpty: true, defaultBranchRef: null } },
      V7Issues: { node: { issues: connection([]) } },
    };
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const operation = /query (\w+)/.exec(JSON.parse(String(init?.body)).query)?.[1] ?? "";
      if (!(operation in responses)) throw new Error("Unexpected GraphQL operation");
      return json({ data: responses[operation] });
    }));
    const gh = (await fetchGitHubEvidence("alice", window, "token", { repositoryIds: ["R1"] }))!;
    const a = gh.events.find((e) => e.kind === "accepted_change")!; const b = cb.events.find((e) => e.kind === "accepted_change")!;
    function input(events: typeof gh.events, sources: EngineeringEvidenceInput["scope"]["sources"], selected: string): EngineeringEvidenceInput {
      return { schemaVersion: "v7", window, events, scope: { sources, excludedSources: [], ledgerRevisionIds: [] }, assessments: [],
        repositoryAliases: [{ repositories: [a, b], canonicalProjectId: "verified-project", verifiedAt: window.referenceTime, evidenceReferenceIds: ["fixture:mirror-proof"] }],
        equivalentWorkItems: [{ workItemIds: [a.workItemId, b.workItemId], canonicalWorkItemId: "verified-work", acceptedEventId: selected, evidenceReferenceIds: ["fixture:work-proof"] }],
      };
    }
    const github = aggregateEngineeringEvidence(input(gh.events, [gh.coverage], a.eventId));
    const codeberg = aggregateEngineeringEvidence(input(cb.events, [cb.coverage], b.eventId));
    const accepted = (value: typeof github) => value.acceptedWork.map(({ workItemId, canonicalProjectId, acceptedAt }) => ({ workItemId, canonicalProjectId, acceptedAt }));
    expect(accepted(codeberg)).toEqual(accepted(github)); expect(accepted(codeberg)).toHaveLength(1);
    for (const field of ["changedFiles", "additions", "deletions", "leadTimeHours", "hasDescription", "usesFeatureBranch"] as const) expect(b.measurements[field]).toEqual(a.measurements[field]);
    const { issueLinkageRate: ghLinks, ...ghDiagnostics } = github.diagnostics;
    const { issueLinkageRate: cbLinks, ...cbDiagnostics } = codeberg.diagnostics;
    expect(cbDiagnostics).toEqual(ghDiagnostics);
    expect(ghLinks.unknownCount).toBe(0); expect(cbLinks.unknownCount).toBe(1);
    expect(a.subjectId).not.toBe(b.subjectId); expect(a.provider).not.toBe(b.provider);
    const combined = aggregateEngineeringEvidence(input([...gh.events, ...cb.events], [gh.coverage, cb.coverage], a.eventId));
    expect(accepted(combined)).toEqual(accepted(github));
    expect(combined.acceptedWork[0]?.evidenceReferenceIds).toEqual(expect.arrayContaining([...a.artifactReferenceIds, ...b.artifactReferenceIds]));
  });
});
