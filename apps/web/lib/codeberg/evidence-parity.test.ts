import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectCodebergSlice } from "./evidence";

/**
 * Ported fidelity suite (#1335 phase 3 part B/C) -- see the header comment in
 * ../github/evidence-parity.test.ts for the two contract differences this
 * suite accounts for (no `progress` array; `coverage: null` on any stop).
 */

const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const actor = { id: 7, login: "alice" };
const repo = (id = 10) => ({ id, full_name: `team/project${id}`, name: `project${id}`, owner: { login: "team" }, has_issues: true });
const pr = (number = 1, fields: Record<string, unknown> = {}) => ({ id: 1000 + number, number, user: actor, merged: true, merged_at: date, created_at: "2024-01-01T00:00:00Z", head: { sha: "aaaaaaaaaaaa" }, merge_commit_sha: "cccccccccccc", body: "Reason", changed_files: 1, additions: 2, deletions: 1, ...fields });
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

const credential = { token: "secret" };
function ownedInput(): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "codeberg", host: "codeberg.org", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(repositoryIds: readonly string[]): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "codeberg", host: "codeberg.org", login: "alice" }, window, scope: { discovery: "explicit_repositories", repositoryIds, eventKinds: [] } };
}
async function runToCompletion(initInput = ownedInput(), maxRequests = 400) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  const stagedKeys = new Set<string>();
  for (let slices = 0; slices < 500; slices++) {
    const result = await collectCodebergSlice(initInput, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
    if (result.stop?.stopKind !== "budget" && result.stop?.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
  throw new Error("runaway slice loop");
}

describe("collectCodebergSlice -- ported diagnostic matrix (hard stops)", () => {
  it("classifies a real HTTP 500 as an http stop, still source_error-equivalent", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({}, 500) : undefined);
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "codeberg", operation: "commits", stopKind: "http", httpStatus: 500 });
  });
  it("classifies a malformed (non-array) response body as a protocol stop, still source_error-equivalent", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json({ not: "an array" }) : undefined);
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.stop).toMatchObject({ provider: "codeberg", operation: "commits", stopKind: "protocol" });
  });
  it("classifies an unparseable authored-commit date as a soft, non-halting source_error reason", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json([{ sha: "dddddddddddd", author: actor, commit: { author: { date: "" } } }]) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.reasonCodes).toContain("source_error");
  });
  it("absorbs an unavailable (403) reviews endpoint as a soft not_accessible reason: the job completes with partial coverage rather than blocking forever", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json({}, 403) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("not_accessible");
  });
  it("does not follow a foreign pagination link, classifying it as a protocol stop", async () => {
    api((url) => url.pathname.endsWith("/commits") ? json([], 200, { link: '<https://evil.test/steal?page=2>; rel="next"' }) : undefined);
    const fetcher = vi.mocked(fetch);
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(fetcher.mock.calls.every(([url, options]) => new URL(String(url)).origin === "https://codeberg.org" && (options as RequestInit)?.redirect === "error")).toBe(true);
    expect(result.stop).toMatchObject({ provider: "codeberg", operation: "commits", stopKind: "protocol" });
    expect(JSON.stringify(result)).not.toContain("evil.test");
  });
  it("marks a repos deadline stop as done:false, stopKind deadline, never source_error", async () => {
    vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => {
      const url = new URL(input); const path = decodeURIComponent(url.pathname).replace("/api/v1", "");
      if (path === "/users/alice/repos") return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)); });
      if (path === "/user") return Promise.resolve(json(actor));
      if (path === "/user/repos") return Promise.resolve(json([]));
      if (path === "/users/alice/activities/feeds") return Promise.resolve(json([]));
      throw new Error(`Unexpected endpoint ${path}`);
    }));
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 50 }, new Set());
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "codeberg", operation: "repos", stopKind: "deadline" });
  });
});

describe("collectCodebergSlice -- ported business-logic parity (soft reasons, complete runs)", () => {
  it("discovers contributed repos and emits actual attributable dated events", async () => {
    api(); const result = await runToCompletion();
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
    const result = await runToCompletion();
    expect(result.events.some((e) => e.kind === "accepted_change")).toBe(true);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toEqual([]);
  });
  it("dates reviews and closures independently of old merges", async () => {
    api((url) => {
      if (url.pathname.endsWith("/pulls")) return json([pr(1, { merged_at: "2024-01-01T00:00:00Z" })]);
      if (url.pathname.endsWith("/timeline")) return json([{ id: 40, type: "close", user: actor, created_at: "2024-01-01T00:00:00Z" }]);
    });
    const result = await runToCompletion();
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
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "review")).toEqual([]);
  });
  it("traverses the 51st contributed repository within a sufficient shared budget", async () => {
    api((url) => {
      if (url.pathname.endsWith("/activities/feeds")) return url.searchParams.get("page") === "1" ? json(Array.from({ length: 50 }, (_, i) => ({ act_user_id: 7, repo: repo(i + 1) })), 200, { "x-total-count": "51" }) : json([{ act_user_id: 7, repo: repo(51) }], 200, { "x-total-count": "51" });
      if (/\/(commits|pulls|issues)$/.test(url.pathname)) return json([]);
    });
    const result = await runToCompletion(ownedInput(), 400);
    expect(result.coverage.repositoryIds).toHaveLength(51);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("project51/commits"))).toBe(true);
  });
  it.each([{ additions: undefined }, { deletions: -1 }, { additions: 0 }, { filename: undefined }, { truncated: true }])("retains unknown measurements for incomplete files: %j", async (fields) => {
    api((url) => url.pathname.endsWith("/files") ? json([{ ...file, ...fields }]) : undefined);
    const result = await runToCompletion();
    const event = result.events.find((e) => e.kind === "accepted_change")!;
    expect(event.measurements.changedFiles.status).toBe("unknown");
    expect(event.measurements.additions.status).toBe("unknown");
    expect(result.coverage.reasonCodes).toContain("partial_files");
  });
  it("rejects files tied to a moved head instead of the archived PR revision", async () => {
    api((url) => url.pathname.includes("/git/refs/pull/") ? json([{ ref: "refs/pull/1/head", object: { sha: "ffffffffffff" } }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
  });
  it("binds the accepted artifact to its merge commit rather than a later source branch head", async () => {
    api((url) => url.pathname.endsWith("/pulls") ? json([pr(1, { head: { sha: "ffffffffffff" } })]) : undefined);
    const result = await runToCompletion();
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.artifactRevision).toBe("cccccccccccc");
    expect(accepted.measurements.changedFiles.status).toBe("unknown");
    expect(accepted.artifactReferenceIds).toContain("codeberg.org:repository:10:commit:cccccccccccc");
  });
  it("keeps both rename sides in complete file observations", async () => {
    api((url) => url.pathname.endsWith("/files") ? json([{ ...file, status: "renamed", previous_filename: "src/a.ts" }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["src/a.ts", "docs/a.md"] });
  });
  it("keeps empty approval clicks unassessed with no category credit", async () => {
    api(); const result = await runToCompletion();
    for (const event of result.events.filter((e) => e.kind === "review")) { expect(event.categories).toEqual([]); expect(event.acceptance.status).toBe("unknown"); }
  });
  it("keeps first reachability unknown even if authored work predates the window", async () => {
    api((url) => {
      if (url.pathname.endsWith("/commits")) return json([{ sha: "dddddddddddd", author: actor, commit: { author: { date: "2024-01-01T00:00:00Z" } } }]);
      if (/\/(pulls|issues)$/.test(url.pathname)) return json([]);
    });
    const result = await runToCompletion(explicitInput(["10"]));
    expect(result.events).toEqual([]); expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("keeps a review's artifact revision stable across collections despite a changed updated_at (#1335 phase 1.5 parity)", async () => {
    api((url) => url.pathname.endsWith("/reviews") ? json([{ id: 20, user: actor, state: "APPROVED", submitted_at: date, updated_at: date, commit_id: "aaaaaaaaaaaa", body: "" }]) : undefined);
    const first = await runToCompletion();
    api((url) => url.pathname.endsWith("/reviews") ? json([{ id: 20, user: actor, state: "APPROVED", submitted_at: date, updated_at: "2026-09-05T00:00:00Z", commit_id: "aaaaaaaaaaaa", body: "" }]) : undefined);
    const second = await runToCompletion();
    const revision = (result: { events: readonly NormalizedEngineeringEvent[] }) => result.events.find((e) => e.kind === "review")?.artifactRevision;
    expect(revision(first)).toBeDefined();
    expect(revision(first)).toBe(revision(second));
  });
  it("absorbs a not_accessible fan-out item (one PR's ref became inaccessible, e.g. the repo went private) as a soft reason: the slice completes, coverage is partial with not_accessible, and the other PR is still collected", async () => {
    api((url) => {
      if (url.pathname.endsWith("/pulls")) return json([pr(1), pr(2)]);
      if (url.pathname.includes("/git/refs/pull/1/")) return json({}, 403);
      if (url.pathname.endsWith("/pulls/1/reviews") || url.pathname.endsWith("/pulls/2/reviews")) return json([]);
    });
    const result = await runToCompletion();
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("not_accessible");
    const accepted = result.events.filter((e) => e.kind === "accepted_change");
    expect(accepted).toHaveLength(2);
    const pr1 = accepted.find((e) => e.workItemId.endsWith(":pr:1"));
    const pr2 = accepted.find((e) => e.workItemId.endsWith(":pr:2"));
    expect(pr1?.measurements.changedFiles.status).toBe("unknown");
    expect(pr2?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md"] });
  });
  it("only the identity (profile / /user) operation can produce a terminal not_accessible stop", async () => {
    api((url) => url.pathname === "/api/v1/user" ? json({}, 403) : undefined);
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "codeberg", operation: "profile", stopKind: "not_accessible" });
  });
});
