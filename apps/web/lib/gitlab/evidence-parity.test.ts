import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitlabSlice } from "./evidence";

/**
 * Ported fidelity suite (#1335 phase 3 part B/C) -- see the header comment in
 * ../github/evidence-parity.test.ts for the two contract differences this
 * suite accounts for (no `progress` array; `coverage: null` on any stop).
 */

const window = createScoringWindow("2026-09-05T12:00:00Z");
const date = "2026-09-04T12:00:00Z";
const mr = (iid = 1, overrides: Record<string, unknown> = {}) => ({
  id: 1000 + iid, iid, project_id: 10, author: { id: 7 }, state: "merged", merged_at: date,
  created_at: "2024-01-01T12:00:00Z", sha: `sha${iid}`, description: "A reason", changes_count: "1", ...overrides,
});
const diff = { old_path: "docs/a.md", new_path: "docs/a.md", diff: "@@ -1 +1 @@\n-old\n+new", collapsed: false, too_large: false };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers });
type Override = (url: URL) => Response | undefined;
function api(override?: Override) {
  return vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); const path = url.pathname.replace("/api/v4", "");
    const custom = override?.(url); if (custom) return custom;
    if (path === "/user") return json({ id: 7, username: "alice", name: "Alice", email: "alice@example.test", confirmed_at: date });
    if (path === "/user/emails") return json([{ email: "alice@example.test", confirmed_at: date }]);
    if (path === "/users/7/projects" || path === "/users/7/contributed_projects") return json([{ id: 10 }]);
    if (path === "/merge_requests") return json([mr()]);
    if (path === "/projects/10/merge_requests") return json([mr()]);
    if (/\/merge_requests\/\d+$/.test(path)) return json(mr(Number(path.split("/").at(-1))));
    if (path.endsWith("/diffs")) return json([diff]);
    if (path.endsWith("/notes")) return json([{ id: 21, author: { id: 7 }, created_at: date, updated_at: date, system: false, body: "Check edge case" }]);
    if (path.endsWith("/repository/commits")) return json([
      { id: "c1", author_email: "alice@example.test", authored_date: date, committed_date: "2026-09-05T12:00:00Z", stats: { additions: 2, deletions: 1 } },
      { id: "c2", author_email: "other@example.test", author_name: "alice", authored_date: date },
    ]);
    if (path.endsWith("/issues")) return json([{ id: 31, iid: 3, project_id: 10 }]);
    if (path.endsWith("/resource_state_events")) return json([
      { id: 41, user: { id: 7 }, state: "closed", created_at: date, source_merge_request_id: 1001 },
      { id: 42, user: { id: 8 }, state: "closed", created_at: date },
    ]);
    throw new Error(`Unexpected endpoint ${path}`);
  }));
}
afterEach(() => vi.unstubAllGlobals());

const credential = { token: "secret" };
function ownedInput(): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "gitlab", host: "gitlab.com", login: "alice" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(projectIds: readonly string[]): SourceContextInput {
  return { owner: "alice", requestedSource: { provider: "gitlab", host: "gitlab.com", login: "alice" }, window, scope: { discovery: "explicit_repositories", repositoryIds: projectIds, eventKinds: [] } };
}
async function runToCompletion(initInput = ownedInput(), maxRequests = 200) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  for (let slices = 0; slices < 500; slices++) {
    const result = await collectGitlabSlice(initInput, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, staged);
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, coverage: result.coverage! };
    if (result.stop?.stopKind !== "budget" && result.stop?.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
  throw new Error("runaway slice loop");
}

describe("collectGitlabSlice -- ported diagnostic matrix (hard stops)", () => {
  it("classifies a real HTTP 500 as an http stop, still source_error-equivalent", async () => {
    api((url) => url.pathname === "/api/v4/merge_requests" ? json({}, 500) : undefined);
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "merge_requests", stopKind: "http", httpStatus: 500 });
  });
  it("classifies a malformed (non-array) response body as a protocol stop, still source_error-equivalent", async () => {
    api((url) => url.pathname === "/api/v4/merge_requests" ? json({ not: "an array" }) : undefined);
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "merge_requests", stopKind: "protocol" });
  });
  it("classifies an unparseable note date as a soft, non-halting source_error reason", async () => {
    api((url) => url.pathname.endsWith("/notes") ? json([{ id: 21, author: { id: 7 }, created_at: "", system: false, body: "Check this" }]) : undefined);
    const result = await runToCompletion();
    expect(result.coverage.reasonCodes).toContain("source_error");
  });
  it("classifies a transient diffs-page HTTP failure as a retryable http stop rather than silently downgrading to measured zero", async () => {
    api((url) => url.pathname.endsWith("/diffs") ? json({}, 500) : undefined);
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "diffs", stopKind: "http", httpStatus: 500 });
  });
  it("classifies an unavailable (403) notes endpoint as a not_accessible stop -- a lost-access job failure now recovers via reconnect, not a silently downgraded permanent partial (see the report)", async () => {
    api((url) => url.pathname.endsWith("/notes") ? json({}, 403) : undefined);
    const result = await collectGitlabSlice(explicitInput(["10"]), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "notes", stopKind: "not_accessible", httpStatus: 403 });
  });
  it("retains preceding pages and resumes from the failed page instead of restarting", async () => {
    api((url) => {
      if (url.pathname !== "/api/v4/merge_requests") return;
      return url.searchParams.get("page") === "1" ? json([mr()], 200, { "x-next-page": "2" }) : json({}, 500);
    });
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "gitlab", stopKind: "http" });
    expect(result.checkpoint.operations.some((op) => op.cursor === "2")).toBe(true);
  });
  it("marks a merge_requests deadline stop as done:false, stopKind deadline, never source_error", async () => {
    vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => {
      const url = new URL(input); const path = url.pathname.replace("/api/v4", "");
      if (path === "/merge_requests") return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)); });
      if (path === "/user") return Promise.resolve(json({ id: 7, username: "alice", name: "Alice", email: "alice@example.test", confirmed_at: date }));
      if (path === "/user/emails") return Promise.resolve(json([{ email: "alice@example.test", confirmed_at: date }]));
      if (path === "/users/7/projects" || path === "/users/7/contributed_projects") return Promise.resolve(json([{ id: 10 }]));
      if (path === "/projects/10/merge_requests") return Promise.resolve(json([]));
      if (path.endsWith("/repository/commits")) return Promise.resolve(json([]));
      if (path.endsWith("/issues")) return Promise.resolve(json([]));
      throw new Error(`Unexpected endpoint ${path}`);
    }));
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 50 }, []);
    expect(result.done).toBe(false);
    expect(result.coverage).toBeNull();
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "merge_requests", stopKind: "deadline" });
  });
});

describe("collectGitlabSlice -- ported business-logic parity (soft reasons, complete runs)", () => {
  it("emits actual authored commits, merge-time changes and attributable dated diagnostics", async () => {
    api(); const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "authored_commit").map((e) => e.eventId)).toEqual(["gitlab.com:project:10:commit:c1"]);
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.occurredAt).toBe(date.replace("Z", ".000Z"));
    expect(accepted.acceptance).toMatchObject({ status: "observed", value: { acceptedAt: accepted.occurredAt } });
    expect(accepted.measurements.changedFiles).toMatchObject({ status: "observed", value: ["docs/a.md"] });
    expect(accepted.measurements.additions).toMatchObject({ status: "observed", value: 1 });
    expect(accepted.measurements.usesFeatureBranch.status).toBe("unknown");
    const closure = result.events.find((e) => e.kind === "issue_work")!;
    expect(closure.workItemId).toBe(accepted.workItemId);
    expect(closure.acceptance.status).toBe("unknown");
    expect(result.events.filter((e) => e.kind === "issue_work")).toHaveLength(1);
    expect(result.events.find((e) => e.kind === "review")?.categories).toEqual([]);
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.unknownPeriods).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("alice@example.test");
    expect(JSON.stringify(result)).not.toContain("secret");
    for (const [url] of vi.mocked(fetch).mock.calls) expect(new URL(String(url)).searchParams.has("created_after")).toBe(false);
  });
  it("dates reviews independently of merge dates, excluding old and post-reference notes", async () => {
    api((url) => {
      if (url.pathname === "/api/v4/projects/10/merge_requests") return json([mr(1, { merged_at: "2020-01-01T00:00:00Z" }), mr(2)]);
      if (url.pathname.endsWith("/1/notes")) return json([{ id: 1, author: { id: 7 }, created_at: date, system: false, body: "review" }]);
      if (url.pathname.endsWith("/2/notes")) return json([{ id: 2, author: { id: 7 }, created_at: "2020-01-01T00:00:00Z", system: false }, { id: 3, author: { id: 7 }, created_at: "2026-09-06T00:00:00Z", system: false }]);
    });
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(1);
  });
  it.each([{ collapsed: true }, { too_large: true }, { diff: undefined }, { diff: "" }, { overflow: true }])("keeps failed or incomplete diffs unknown: %j", async (flags) => {
    api((url) => url.pathname.endsWith("/diffs") ? json([{ ...diff, ...flags }]) : undefined);
    const result = await runToCompletion();
    const event = result.events.find((e) => e.kind === "accepted_change")!;
    expect(event.measurements.additions.status).toBe("unknown");
    expect(event.measurements.changedFiles.status).toBe("unknown");
    expect(result.coverage.reasonCodes).toContain("partial_files");
  });
  it("processes more than ten review candidates", async () => {
    api((url) => url.pathname === "/api/v4/projects/10/merge_requests" ? json(Array.from({ length: 12 }, (_, i) => mr(i + 1))) : undefined);
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(12);
  });
  it("never promotes closure actor into teammate MR authorship", async () => {
    api((url) => url.pathname.endsWith("/merge_requests") ? json([mr(1, { author: { id: 8 } })]) : undefined);
    const result = await runToCompletion();
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(0);
    expect(result.events.find((e) => e.kind === "issue_work")?.acceptance).toMatchObject({ status: "unknown", reasonCode: "attribution_unknown" });
  });
  it("retains empty notes only as unassessed diagnostics with no credit", async () => {
    api((url) => url.pathname.endsWith("/notes") ? json([{ id: 1, author: { id: 7 }, created_at: date, body: "", system: false }]) : undefined);
    const result = await runToCompletion();
    const note = result.events.find((e) => e.kind === "review")!;
    expect(note.categories).toEqual([]); expect(note.acceptance.status).toBe("unknown");
  });
  it("includes both rename paths so code renamed to docs is not classified docs-only", async () => {
    api((url) => url.pathname.endsWith("/diffs") ? json([{ ...diff, old_path: "src/a.ts", new_path: "docs/a.md", renamed_file: true }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles).toMatchObject({ status: "observed", value: ["src/a.ts", "docs/a.md"] });
  });
  it("counts content beginning with diff-header characters inside a valid hunk", async () => {
    api((url) => url.pathname.endsWith("/diffs") ? json([{ ...diff, diff: "@@ -1 +1 @@\n---actual removed content\n+++actual added content" }]) : undefined);
    const result = await runToCompletion();
    const value = result.events.find((e) => e.kind === "accepted_change")!;
    expect(value.measurements.additions).toMatchObject({ status: "observed", value: 1 });
    expect(value.measurements.deletions).toMatchObject({ status: "observed", value: 1 });
  });
  it("rejects truncated unified hunks even if the API forgot its overflow flag", async () => {
    api((url) => url.pathname.endsWith("/diffs") ? json([{ ...diff, diff: "@@ -1,4 +1,4 @@\n-old\n+new" }]) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.additions.status).toBe("unknown");
  });
  it("cannot bind current diffs to a different accepted artifact revision", async () => {
    api((url) => /merge_requests\/1$/.test(url.pathname) ? json(mr(1, { sha: "different-revision" })) : undefined);
    const result = await runToCompletion();
    expect(result.events.find((e) => e.kind === "accepted_change")?.measurements.changedFiles.status).toBe("unknown");
  });
  it("classifies an unavailable (403) emails endpoint as a not_accessible stop rather than a silent attribution downgrade", async () => {
    api((url) => {
      if (url.pathname === "/api/v4/user") return json({ id: 7, username: "alice" });
      if (url.pathname === "/api/v4/user/emails") return json({}, 403);
    });
    const result = await collectGitlabSlice(explicitInput(["10"]), credential, EMPTY_CHECKPOINT, { maxRequests: 200, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop).toMatchObject({ provider: "gitlab", operation: "emails", stopKind: "not_accessible", httpStatus: 403 });
  });
  it("keeps acceptance time unknown when an old-authored commit may first land inside the window", async () => {
    api((url) => {
      if (url.pathname.endsWith("/merge_requests") || url.pathname.endsWith("/issues")) return json([]);
      if (url.pathname.endsWith("/repository/commits")) return json([{ id: "old-authored", author_email: "alice@example.test", authored_date: "2024-01-01T00:00:00Z", committed_date: date }]);
    });
    const result = await runToCompletion(explicitInput(["10"]));
    expect(result.events).toEqual([]);
    expect(result.coverage.eventKinds.accepted_change).toBe("partial");
    expect(result.coverage.reasonCodes).toContain("acceptance_time_unknown");
  });
  it("keeps a note's artifact revision stable across collections despite a changed updated_at (#1335 phase 1.5 parity)", async () => {
    api((url) => url.pathname.endsWith("/notes") ? json([{ id: 21, author: { id: 7 }, created_at: date, updated_at: date, system: false, body: "Check this" }]) : undefined);
    const first = await runToCompletion();
    api((url) => url.pathname.endsWith("/notes") ? json([{ id: 21, author: { id: 7 }, created_at: date, updated_at: "2026-09-05T00:00:00Z", system: false, body: "Edited" }]) : undefined);
    const second = await runToCompletion();
    const revision = (result: { events: readonly NormalizedEngineeringEvent[] }) => result.events.find((e) => e.kind === "review")?.artifactRevision;
    expect(revision(first)).toBeDefined();
    expect(revision(first)).toBe(revision(second));
  });
});
