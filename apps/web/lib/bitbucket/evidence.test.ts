import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateEngineeringEvidence, createScoringWindow, type EngineeringEvidenceInput, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import { fetchGitHubEvidence } from "../github/evidence";
import { fetchBitbucketEvidence } from "./evidence";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const U = "{11111111-1111-1111-1111-111111111111}";
const W = "{22222222-2222-2222-2222-222222222222}";
const R = "{33333333-3333-3333-3333-333333333333}";
const subject = { uuid: U, account_id: "account-1" };
const other = { uuid: "{44444444-4444-4444-4444-444444444444}", account_id: "account-2" };
const source = { commit: { hash: "aaaaaaaaaaaa" } };
const destination = { commit: { hash: "bbbbbbbbbbbb" } };
const repository = { uuid: R, workspace: { uuid: W }, full_name: "team/project", has_issues: true };
const pr = (id = 1, fields = {}) => ({ id, author: subject, state: "MERGED", source, destination, merge_commit: { hash: "cccccccccccc" }, created_on: "2024-01-01T00:00:00Z", updated_on: date, description: "Reason", ...fields });
const merge = (when = date) => ({ update: { state: "MERGED", date: when, author: other, source, destination } });
const diff = { status: "modified", lines_added: 2, lines_removed: 1, old: { path: "docs/a.md" }, new: { path: "docs/a.md" } };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers });
const page = (values: unknown[], next?: string) => json({ values, ...(next ? { next } : {}) });
type Override = (url: URL) => Response | undefined;
function api(override?: Override) {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/2.0", "");
    const custom = override?.(url); if (custom) return custom;
    if (path === "/user") return json({ ...subject, display_name: "Alice" });
    if (path === "/user/workspaces") return page([{ workspace: { uuid: W } }]);
    if (path === `/repositories/${W}`) return page([repository]);
    if (path === `/repositories/${W}/${R}`) return json(repository);
    if (path.endsWith("/commits")) return page([
      { hash: "dddddddddddd", date, author: { user: subject } },
      { hash: "eeeeeeeeeeee", date, author: { user: other } },
    ]);
    if (path.endsWith("/pullrequests")) return page([pr(), pr(2, { state: "OPEN", author: other })]);
    if (path.endsWith("/1/activity")) return page([merge(), { approval: { date, user: subject } }]);
    if (path.endsWith("/2/activity")) return page([{ comment: { id: 12, created_on: date, updated_on: date, user: subject, content: { raw: "Check this" } } }]);
    if (path.endsWith("/diffstat")) return json({}, 302, { location: `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(W)}/${encodeURIComponent(R)}/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb?topic=true` });
    if (path.includes("/diffstat/")) return page([diff]);
    throw new Error(`Unexpected path ${path}`);
  }));
}
afterEach(() => vi.unstubAllGlobals());
describe("Bitbucket v7 evidence", () => {
  it("uses stable UUIDs without usernames and actual authored commits", async () => {
    api(); const result = await fetchBitbucketEvidence("account-1", "secret", window);
    expect(result.coverage.source).toMatchObject({ provider: "bitbucket", host: "bitbucket.org", subjectId: U });
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(1);
    expect(result.events.find((e) => e.kind === "authored_commit")?.artifactRevision).toBe("dddddddddddd");
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.occurredAt).toBe(date.replace("Z", ".000Z"));
    expect(accepted.acceptance).toMatchObject({ status: "observed", value: { acceptedAt: accepted.occurredAt } });
    expect(accepted.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md"] });
    expect(accepted.measurements.additions).toMatchObject({ status: "observed", value: 2 });
    expect(accepted.measurements.usesFeatureBranch.status).toBe("unknown");
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
    expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("does not rejuvenate an old merge when updated_on or a later MERGED-state edit changes", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? page([merge(), merge("2024-01-01T00:00:00Z")]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.events.some((e) => e.kind === "review")).toBe(true);
  });
  it("reviews on open PRs are dated independently and old/future reviews excluded", async () => {
    api((url) => url.pathname.endsWith("/2/activity") ? page([
      { approval: { user: subject, date } },
      { approval: { user: subject, date: "2024-01-01T00:00:00Z" } },
      { approval: { user: subject, date: "2026-09-06T00:00:00Z" } },
      { approval: { user: other, date } },
    ]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
  });
  it("retains page-one facts and the incoming cursor after a page-two 429, honestly as rate_limited", async () => {
    api((url) => {
      if (!url.pathname.endsWith("/commits")) return;
      return url.searchParams.has("page") ? json({}, 429) : page([{ hash: "dddddddddddd", date, author: { user: subject } }], `${url.origin}${url.pathname}?page=2`);
    });
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(true);
    expect(result.progress.find((p) => p.initialUrl.includes("/commits"))).toMatchObject({ complete: false, collectedNodes: 1 });
    expect(result.progress.find((p) => p.initialUrl.includes("/commits"))?.nextUrl).toContain("page=2");
    expect(result.coverage.reasonCodes).toContain("pagination_incomplete");
    expect(result.coverage.reasonCodes).not.toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "rate_limited", httpStatus: 429 }));
  });
  it("does not claim a merge timestamp from a truncated activity history", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? (url.searchParams.has("page") ? json({}, 500) : page([merge()], `${url.origin}${url.pathname}?page=2`)) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.some((e) => e.kind === "accepted_change" && e.acceptance.status === "observed")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("paginates every diffstat page and retains both rename paths", async () => {
    api((url) => {
      if (!url.pathname.includes("/diffstat/")) return;
      return url.searchParams.has("page") ? page([{ ...diff, status: "renamed", old: { path: "src/a.ts" }, new: { path: "docs/b.md" } }]) : page([diff], `${url.origin}${url.pathname}?topic=true&page=2`);
    });
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md", "src/a.ts", "docs/b.md"] });
  });
  it.each([{ lines_added: undefined }, { lines_removed: -1 }, { truncated: true }, { new: {} }])("does not turn malformed diffstats into measured zero: %j", async (flags) => {
    api((url) => url.pathname.includes("/diffstat/") ? page([{ ...diff, ...flags }]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.additions.status).toBe("unknown");
    expect(result.coverage.reasonCodes).toContain("partial_files");
  });
  it("keeps diffstat page-one progress on a nested page-two failure without publishing a partial file list", async () => {
    api((url) => {
      if (!url.pathname.includes("/diffstat/")) return;
      return url.searchParams.has("page") ? json({}, 429) : page([diff], `${url.origin}${url.pathname}?topic=true&page=2`);
    });
    const result = await fetchBitbucketEvidence(U, "token", window);
    const progress = result.progress.find((p) => p.initialUrl.includes("/diffstat/"))!;
    expect(progress).toMatchObject({ complete: false, collectedNodes: 1 });
    expect(progress.nextUrl).toContain("page=2");
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
  });
  it("does not infer commit authorship from a nickname when account linkage is absent", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([{ hash: "dddddddddddd", date, author: { raw: "Alice <private@test>", user: { nickname: "Alice" } } }]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("attribution_unknown");
    expect(JSON.stringify(result)).not.toContain("private@test");
  });
  it("reports failed nested diffstats as unknown while retaining acceptance", async () => {
    api((url) => url.pathname.includes("/diffstat/") ? json({}, 555) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    const event = result.events.find((e) => e.kind === "accepted_change")!;
    expect(event.acceptance.status).toBe("observed"); expect(event.measurements.changedFiles.status).toBe("unknown");
  });
  it("rejects foreign next URLs before sending credentials", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([], "https://evil.test/steal") : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => new URL(String(url)).origin === "https://api.bitbucket.org")).toBe(true);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "protocol" }));
    expect(JSON.stringify(result)).not.toContain("evil.test");
  });
  it("does not follow HTTP redirects with credentials", async () => {
    api((url) => url.pathname.includes("/diffstat/") ? json({}, 302, { location: "https://evil.test" }) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.redirect === "error" || init?.redirect === "manual")).toBe(true);
    expect(result.coverage.reasonCodes).toContain("source_error");
  });
  it.each([
    "https://evil.test/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://user:password@api.bitbucket.org/2.0/repositories/team/project/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://api.bitbucket.org:444/2.0/repositories/team/project/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://api.bitbucket.org/2.0/repositories/other/project/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://api.bitbucket.org/2.0/repositories/team/project/diffstat/main..develop",
  ])("rejects unsafe or mutable authoritative diff redirects: %s", async (location) => {
    api((url) => url.pathname.endsWith("/diffstat") ? json({}, 302, { location }) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === location)).toBe(false);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("password");
  });
  it("uses the authoritative redirect comparison rather than a reconstructed destination", async () => {
    api((url) => url.pathname.endsWith("/diffstat") ? json({}, 302, { location: "https://api.bitbucket.org/2.0/repositories/team/project/diffstat/aaaaaaaaaaaa..eeeeeeeeeeee?topic=true" }) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("observed");
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("aaaaaaaaaaaa..eeeeeeeeeeee"))).toBe(true);
  });
  it("leaves empty approvals unassessed with no category credit", async () => {
    api(); const result = await fetchBitbucketEvidence(U, "token", window);
    for (const event of result.events.filter((e) => e.kind === "review")) {
      expect(event.categories).toEqual([]); expect(event.acceptance.status).toBe("unknown");
    }
  });
  it("native issue work is unavailable after API removal, regardless old resolved snapshots", async () => {
    api(); const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.coverage.eventKinds.issue_work).toBe("unavailable");
    expect(result.events.some((e) => e.kind === "issue_work")).toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/issues"))).toBe(false);
  });
  it("keeps first-reachability unknown even with zero authored window events and explicit scope", async () => {
    api((url) => /\/(commits|pullrequests)$/.test(url.pathname) ? page([]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window, { repositories: [{ workspaceId: W, repositoryId: R }] });
    expect(result.events).toEqual([]); expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("uses one request budget and retains unfinished cursors", async () => {
    api(); const result = await fetchBitbucketEvidence(U, "token", window, { maxRequests: 5 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5); expect(result.requestCount).toBe(5);
    expect(result.progress.some((p) => !p.complete && p.nextUrl !== null)).toBe(true);
    expect(result.coverage.reasonCodes).toContain("pagination_incomplete");
    expect(result.diagnostics.some((d) => d.stopKind === "budget")).toBe(true);
  });
  it("marks a commits deadline stop as pagination_incomplete, never source_error, with a deadline diagnostic", async () => {
    vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => {
      const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/2.0", "");
      if (path.endsWith("/commits")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        });
      }
      if (path === "/user") return Promise.resolve(json({ ...subject, display_name: "Alice" }));
      if (path === "/user/workspaces") return Promise.resolve(page([{ workspace: { uuid: W } }]));
      if (path === `/repositories/${W}`) return Promise.resolve(page([repository]));
      if (path.endsWith("/pullrequests")) return Promise.resolve(page([]));
      throw new Error(`Unexpected path ${path}`);
    }));
    const result = await fetchBitbucketEvidence(U, "token", window, { timeoutMs: 50 });
    expect(result.coverage.reasonCodes).toContain("pagination_incomplete");
    expect(result.coverage.reasonCodes).not.toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "deadline" }));
  });
  it("cannot use a later valid merge date when an earlier merge timestamp is malformed", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? page([merge(), merge("invalid-date")]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "activity", stopKind: "parse" }));
  });
  it("resolves a declared repository whose metadata mismatches as a protocol stop", async () => {
    api((url) => url.pathname === `/2.0/repositories/%7B%7D/${encodeURIComponent(R)}` ? json({ uuid: "{99999999-9999-9999-9999-999999999999}", workspace: { uuid: W } }) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window, { repositoryIds: [R] });
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.coverage.repositoryDiscoveryComplete).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "repository", stopKind: "protocol" }));
  });
  it("classifies a non-numeric pull request id as a protocol stop", async () => {
    api((url) => url.pathname.endsWith("/pullrequests") ? page([{ ...pr(), id: "not-a-number" }]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "pullrequests", stopKind: "protocol" }));
  });
  it("classifies a deleted activity comment/approval body as not_accessible", async () => {
    api((url) => url.pathname.endsWith("/2/activity") ? page([{ approval: { user: subject, date, deleted: true } }]) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.coverage.reasonCodes).toContain("not_accessible");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "activity", stopKind: "not_accessible" }));
  });
  it("classifies an HTTP 500 as an http stop, still source_error", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({}, 500) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "http", httpStatus: 500 }));
  });
  it("classifies a 2xx provider error body as a protocol stop, still source_error", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({ type: "error", error: { message: "internal" } }) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "protocol" }));
    expect(JSON.stringify(result)).not.toContain("internal");
  });
  it("keeps a comment's artifact revision stable across collections despite a changed updated_on (#1335 phase 1.5)", async () => {
    api((url) => url.pathname.endsWith("/2/activity")
      ? page([{ comment: { id: 12, created_on: date, updated_on: date, user: subject, content: { raw: "Check this" } } }])
      : undefined);
    const first = await fetchBitbucketEvidence(U, "token", window);
    api((url) => url.pathname.endsWith("/2/activity")
      ? page([{ comment: { id: 12, created_on: date, updated_on: "2026-09-05T00:00:00Z", user: subject, content: { raw: "Edited" } } }])
      : undefined);
    const second = await fetchBitbucketEvidence(U, "token", window);
    const revision = (result: Awaited<ReturnType<typeof fetchBitbucketEvidence>>) => result.events.find((e) => e.kind === "review" && e.eventId.includes(":comment:"))?.artifactRevision;
    expect(revision(first)).toBeDefined();
    expect(revision(first)).toBe(revision(second));
  });
  it("does not match null UUIDs when the account_id belongs to another subject", async () => {
    api((url) => url.pathname === "/2.0/user" ? json({ account_id: "someone-else" }) : undefined);
    await expect(fetchBitbucketEvidence("account-1", "token", window)).rejects.toThrow("subject");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
  it("retains valid nodes but replays a malformed incoming page", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([{ hash: "dddddddddddd", date, author: { user: subject } }, null], `${url.origin}${url.pathname}?page=2`) : undefined);
    const result = await fetchBitbucketEvidence(U, "token", window);
    const progress = result.progress.find((p) => p.initialUrl.includes("/commits"))!;
    expect(progress.complete).toBe(false); expect(progress.nextUrl).toBe(progress.initialUrl);
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ provider: "bitbucket", operation: "commits", stopKind: "protocol" }));
  });
  it("reconciles actual GitHub and Bitbucket adapters through verified project/work mappings", async () => {
    api((url) => {
      if (url.pathname.endsWith("/1/activity")) return page([{ update: { ...merge().update, description: "Reason" } }]);
      if (url.pathname.endsWith("/2/activity")) return page([]);
    });
    const bb = await fetchBitbucketEvidence(U, "fixture-token", window);
    const connection = (nodes: unknown[]) => ({ nodes, totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null } });
    const githubActor = { id: "U1", login: "alice" };
    const githubRepo = { id: "R1", nameWithOwner: "mirror/project" };
    const githubPr = {
      id: "PR1", author: githubActor, repository: githubRepo, merged: true, mergedAt: date,
      createdAt: "2024-01-01T00:00:00Z", headRefOid: "aaaaaaaaaaaa", body: "Reason",
      additions: 2, deletions: 1, changedFiles: 1, closingIssuesReferences: { totalCount: 0 },
    };
    const responses: Record<string, unknown> = {
      V7Profile: { user: githubActor },
      V7MergedChanges: { search: { ...connection([githubPr]), issueCount: 1 } },
      V7Files: { node: { files: connection([{ path: "docs/a.md" }]) } },
      V7ReviewDiscovery: { user: { contributionsCollection: { restrictedContributionsCount: 0, pullRequestReviewContributions: connection([]) } } },
      V7Commits: { node: { defaultBranchRef: { target: { history: connection([
        { id: "C1", oid: "dddddddddddd", authoredDate: date, author: { user: githubActor }, additions: 2, deletions: 1 },
      ]) } } } },
      V7Issues: { node: { issues: connection([]) } },
    };
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const { query } = JSON.parse(String(init?.body));
      const operation = /query (\w+)/.exec(query)?.[1] ?? "";
      if (!(operation in responses)) throw new Error(`Unexpected GitHub operation ${operation}`);
      return json({ data: responses[operation] });
    }));
    const gh = await fetchGitHubEvidence("alice", window, "fixture-token", { repositoryIds: ["R1"] });
    expect(gh).not.toBeNull();
    const ghAccepted = gh!.events.find((e) => e.kind === "accepted_change")!;
    const bbAccepted = bb.events.find((e) => e.kind === "accepted_change")!;
    const ghCommit = gh!.events.find((e) => e.kind === "authored_commit")!;
    const bbCommit = bb.events.find((e) => e.kind === "authored_commit")!;
    const repositoryAliases: EngineeringEvidenceInput["repositoryAliases"] = [{
      repositories: [ghAccepted, bbAccepted], canonicalProjectId: "verified-mirror-project",
      verifiedAt: window.referenceTime, evidenceReferenceIds: ["fixture:verified-project-mirror"],
    }];
    function input(events: readonly NormalizedEngineeringEvent[], sources: readonly SourceCoverage[], selected: NormalizedEngineeringEvent): EngineeringEvidenceInput {
      return {
        schemaVersion: "v7", window, events, scope: { sources, excludedSources: [], ledgerRevisionIds: [] }, assessments: [], repositoryAliases,
        equivalentWorkItems: [{
          workItemIds: [ghAccepted.workItemId, bbAccepted.workItemId], canonicalWorkItemId: "verified-mirror-work",
          acceptedEventId: selected.eventId, evidenceReferenceIds: ["fixture:verified-accepted-work-equivalence"],
        }, {
          workItemIds: [ghCommit.workItemId, bbCommit.workItemId], canonicalWorkItemId: "verified-mirror-commit",
          acceptedEventId: ghCommit.eventId, evidenceReferenceIds: ["fixture:verified-identical-commit"],
        }],
      };
    }
    const github = aggregateEngineeringEvidence(input(gh!.events, [gh!.coverage], ghAccepted));
    const bitbucket = aggregateEngineeringEvidence(input(bb.events, [bb.coverage], bbAccepted));
    const acceptedSummary = (value: typeof github) => value.acceptedWork.map(({ workItemId, canonicalProjectId, acceptedAt }) => ({ workItemId, canonicalProjectId, acceptedAt }));
    expect(acceptedSummary(bitbucket)).toEqual(acceptedSummary(github));
    expect(acceptedSummary(github)).toEqual([{ workItemId: "verified-mirror-work", canonicalProjectId: "verified-mirror-project", acceptedAt: date.replace("Z", ".000Z") }]);
    for (const field of ["changedFiles", "additions", "deletions", "leadTimeHours", "hasDescription", "usesFeatureBranch"] as const) {
      expect(bbAccepted.measurements[field]).toEqual(ghAccepted.measurements[field]);
    }
    const { issueLinkageRate: githubLinks, ...githubDiagnostics } = github.diagnostics;
    const { issueLinkageRate: bitbucketLinks, ...bitbucketDiagnostics } = bitbucket.diagnostics;
    expect(bitbucketDiagnostics).toEqual(githubDiagnostics);
    expect(github.diagnostics.authoredCommits).toBe(1);
    // Preserve real capability/identity differences instead of zeroing them for parity.
    expect(githubLinks).toMatchObject({ denominator: 1, unknownCount: 0, value: 0 });
    expect(bitbucketLinks).toMatchObject({ denominator: 0, unknownCount: 1, value: null });
    expect(bbCommit.measurements.additions.status).toBe("unknown");
    expect(ghCommit.measurements.additions.status).toBe("observed");
    expect(ghAccepted.subjectId).not.toBe(bbAccepted.subjectId);
    expect(ghAccepted.provider).not.toBe(bbAccepted.provider);
    expect(bb.coverage.eventKinds.issue_work).toBe("unavailable");
    expect(gh!.coverage.eventKinds.issue_work).not.toBe("unavailable");
    const combined = aggregateEngineeringEvidence(input([...gh!.events, ...bb.events], [gh!.coverage, bb.coverage], ghAccepted));
    expect(acceptedSummary(combined)).toEqual(acceptedSummary(github));
    expect(combined.diagnostics.authoredCommits).toBe(1);
    expect(combined.acceptedWork[0]?.evidenceReferenceIds).toEqual(expect.arrayContaining([...ghAccepted.artifactReferenceIds, ...bbAccepted.artifactReferenceIds]));
  });
  it("rejects a credential for another account before repository collection", async () => {
    api(); await expect(fetchBitbucketEvidence("wrong-account", "token", window)).rejects.toThrow("subject");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
