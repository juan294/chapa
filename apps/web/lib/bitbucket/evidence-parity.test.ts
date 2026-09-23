import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectBitbucketSlice } from "./evidence";

/**
 * Ported fidelity suite (#1335 phase 3 part B/C) -- see the header comment in
 * ../github/evidence-parity.test.ts for the two contract differences this
 * suite accounts for (no `progress` array; `coverage: null` on any stop).
 */

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
const pr = (id = 1, fields: Record<string, unknown> = {}) => ({ id, author: subject, state: "MERGED", source, destination, merge_commit: { hash: "cccccccccccc" }, created_on: "2024-01-01T00:00:00Z", updated_on: date, description: "Reason", ...fields });
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

const credential = { token: "secret" };
function ownedInput(owner = "account-1"): SourceContextInput {
  return { owner, requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: owner }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(repositoryIds: readonly string[]): SourceContextInput {
  return { owner: "account-1", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "account-1" }, window, scope: { discovery: "explicit_repositories", repositoryIds, eventKinds: [] } };
}
async function runToCompletion(initInput = ownedInput(), maxRequests = 200) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  for (let slices = 0; slices < 500; slices++) {
    const result = await collectBitbucketSlice(initInput, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, staged);
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
    if (result.stop?.stopKind !== "budget" && result.stop?.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
  throw new Error("runaway slice loop");
}

describe("collectBitbucketSlice -- ported diagnostic matrix (hard stops)", () => {
  it("classifies an HTTP 500 as an http stop, still source_error-equivalent", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({}, 500) : undefined);
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "bitbucket", operation: "commits", stopKind: "http", httpStatus: 500 });
  });
  it("classifies a 2xx provider error body as a protocol stop, still source_error-equivalent, without leaking its text", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({ type: "error", error: { message: "internal" } }) : undefined);
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.stop).toMatchObject({ provider: "bitbucket", operation: "commits", stopKind: "protocol" });
    expect(JSON.stringify(result)).not.toContain("internal");
  });
  it("classifies a foreign next URL as a protocol stop before sending credentials", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([], "https://evil.test/steal") : undefined);
    const fetcher = vi.mocked(fetch);
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(fetcher.mock.calls.every(([url]) => new URL(String(url)).origin === "https://api.bitbucket.org")).toBe(true);
    expect(result.stop).toMatchObject({ provider: "bitbucket", operation: "commits", stopKind: "protocol" });
    expect(JSON.stringify(result)).not.toContain("evil.test");
  });
  it("classifies a transient diff-page HTTP failure as a retryable http stop rather than silently downgrading file measurements to unknown forever (the new architecture's whole point -- retry a real failure instead of smoothing over it)", async () => {
    api((url) => url.pathname.includes("/diffstat/") ? json({}, 555) : undefined);
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "bitbucket", operation: "diff", stopKind: "http", httpStatus: 555 });
  });
  it("classifies an unparseable merge-activity date as a soft, non-halting reason: no accepted_change is ever built from it, even once a later valid MERGED update is found", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? page([merge(), merge("invalid-date")]) : undefined);
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("source_error");
  });
  it("surfaces an invalid explicit repository id as a soft not_accessible reason on its own fan-out operations, completing with partial coverage rather than blocking the job (no dedicated pre-resolution step in this engine, unlike the single-run adapter -- see the report)", async () => {
    const missing = "{99999999-9999-9999-9999-999999999999}";
    api((url) => url.pathname.includes(encodeURIComponent(missing)) ? json({ type: "error", error: { message: "not found" } }, 404) : undefined);
    const result = await runToCompletion(explicitInput([missing]));
    expect(result.coverage?.status).toBe("partial");
    expect(result.coverage?.reasonCodes).toContain("not_accessible");
  });
  it("classifies a non-numeric pull request id as a soft, non-halting source_error reason", async () => {
    api((url) => url.pathname.endsWith("/pullrequests") ? page([{ ...pr(), id: "not-a-number" }]) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.reasonCodes).toContain("source_error");
  });
  it("classifies a deleted activity comment/approval body as not_accessible", async () => {
    api((url) => url.pathname.endsWith("/2/activity") ? page([{ approval: { user: subject, date, deleted: true } }]) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.reasonCodes).toContain("not_accessible");
  });
  it("retains valid nodes but stops paginating a page containing a malformed node, rather than following an uncertified cursor", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([{ hash: "dddddddddddd", date, author: { user: subject } }, null], `${url.origin}${url.pathname}?page=2`) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.reasonCodes).toContain("source_error");
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(true);
  });
});

describe("collectBitbucketSlice -- ported business-logic parity (soft reasons, complete runs)", () => {
  it("uses stable UUIDs without usernames and actual authored commits", async () => {
    api(); const result = await runToCompletion();
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
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("does not rejuvenate an old merge when a later MERGED-state edit conflicts", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? page([merge(), merge("2024-01-01T00:00:00Z")]) : undefined);
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.events.some((e) => e.kind === "review")).toBe(true);
  });
  it("reviews on open PRs are dated independently, old/future reviews excluded", async () => {
    api((url) => url.pathname.endsWith("/2/activity") ? page([
      { approval: { user: subject, date } },
      { approval: { user: subject, date: "2024-01-01T00:00:00Z" } },
      { approval: { user: subject, date: "2026-09-06T00:00:00Z" } },
      { approval: { user: other, date } },
    ]) : undefined);
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
  });
  it("does not claim a merge timestamp from an activity history that never returns a MERGED update", async () => {
    api((url) => url.pathname.endsWith("/1/activity") ? page([]) : undefined);
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("paginates every diffstat page and retains both rename paths", async () => {
    api((url) => {
      if (!url.pathname.includes("/diffstat/")) return;
      return url.searchParams.has("page") ? page([{ ...diff, status: "renamed", old: { path: "src/a.ts" }, new: { path: "docs/b.md" } }]) : page([diff], `${url.origin}${url.pathname}?topic=true&page=2`);
    });
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md", "src/a.ts", "docs/b.md"] });
  });
  it.each([{ lines_added: undefined }, { lines_removed: -1 }, { truncated: true }])("does not turn a malformed diffstat into measured zero: %j", async (flags) => {
    api((url) => url.pathname.includes("/diffstat/") ? page([{ ...diff, ...flags }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.additions.status).toBe("unknown");
    expect(result.coverage.reasonCodes).toContain("partial_files");
  });
  it("does not infer commit authorship from a nickname when account linkage is absent", async () => {
    api((url) => url.pathname.endsWith("/commits") ? page([{ hash: "dddddddddddd", date, author: { raw: "Alice <private@test>", user: { nickname: "Alice" } } }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "authored_commit")).toBe(false);
    expect(result.coverage.reasonCodes).toContain("attribution_unknown");
    expect(JSON.stringify(result)).not.toContain("private@test");
  });
  it.each([
    "https://evil.test/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://user:password@api.bitbucket.org/2.0/repositories/team/project/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
    "https://api.bitbucket.org:444/2.0/repositories/team/project/diffstat/aaaaaaaaaaaa..bbbbbbbbbbbb",
  ])("rejects unsafe authoritative diff redirects: %s", async (location) => {
    api((url) => url.pathname.endsWith("/diffstat") ? json({}, 302, { location }) : undefined);
    const result = await runToCompletion();
    const fetcher = vi.mocked(fetch);
    expect(fetcher.mock.calls.some(([url]) => String(url) === location)).toBe(false);
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("password");
  });
  it("leaves empty approvals unassessed with no category credit", async () => {
    api(); const result = await runToCompletion();
    for (const event of result.events.filter((e) => e.kind === "review")) {
      expect(event.categories).toEqual([]); expect(event.acceptance.status).toBe("unknown");
    }
  });
  it("native issue work is unavailable after API removal", async () => {
    api(); const result = await runToCompletion();
    expect(result.coverage.eventKinds.issue_work).toBe("unavailable");
    expect(result.events.some((e) => e.kind === "issue_work")).toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/issues"))).toBe(false);
  });
  it("keeps first-reachability unknown even with zero authored window events under explicit scope", async () => {
    api((url) => /\/(commits|pullrequests)$/.test(url.pathname) ? page([]) : undefined);
    const result = await runToCompletion(explicitInput([R]));
    expect(result.events).toEqual([]); expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("keeps a comment's artifact revision stable across collections despite a changed updated_on (#1335 phase 1.5)", async () => {
    api((url) => url.pathname.endsWith("/2/activity") ? page([{ comment: { id: 12, created_on: date, updated_on: date, user: subject, content: { raw: "Check this" } } }]) : undefined);
    const first = await runToCompletion();
    api((url) => url.pathname.endsWith("/2/activity") ? page([{ comment: { id: 12, created_on: date, updated_on: "2026-09-05T00:00:00Z", user: subject, content: { raw: "Edited" } } }]) : undefined);
    const second = await runToCompletion();
    const revision = (result: { events: readonly NormalizedEngineeringEvent[] }) => result.events.find((e) => e.kind === "review" && e.eventId.includes(":comment:"))?.artifactRevision;
    expect(revision(first)).toBeDefined();
    expect(revision(first)).toBe(revision(second));
  });
});
