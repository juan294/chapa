import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitlabSlice, GITLAB_EXPANDING_OPERATIONS } from "./evidence";
import { isExpandingOperation } from "@/lib/collection/slice-helpers";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const PROJECT_A = "101"; const PROJECT_B = "102";

function ownedInput(): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "gitlab", host: "gitlab.com", login: "juan" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(projectId: string): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "gitlab", host: "gitlab.com", login: "juan" }, window, scope: { discovery: "explicit_repositories", repositoryIds: [projectId], eventKinds: [] } };
}

async function runToCompletion(input: SourceContextInput, maxRequests: number) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  const stagedKeys = new Set<string>();
  let slices = 0;
  for (;;) {
    slices++;
    if (slices > 500) throw new Error("runaway slice loop");
    const result = await collectGitlabSlice(input, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, slices, coverage: result.coverage };
    if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
}

function jsonHeaders(extra: Record<string, string> = {}) { return new Headers({ "content-type": "application/json", ...extra }); }

function setupFetch() {
  const commitsQuery: string[] = [];
  const fetcher = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v4/, "");
    if (path === "/user") return new Response(JSON.stringify({ id: 1, username: "juan", name: "Juan", avatar_url: null, email: "juan@example.com", confirmed_at: "2020-01-01T00:00:00Z" }), { headers: jsonHeaders() });
    if (path === "/user/emails") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === "/merge_requests") return new Response(JSON.stringify([
      { id: 900, iid: 1, project_id: Number(PROJECT_A), author: { id: 1 }, state: "merged", merged_at: "2026-01-05T00:00:00Z", created_at: "2026-01-01T00:00:00Z", sha: "sha-a", description: "fix" },
    ]), { headers: jsonHeaders() });
    if (path === "/users/1/projects" || path === "/users/1/contributed_projects") {
      return new Response(JSON.stringify(path.endsWith("contributed_projects") ? [{ id: Number(PROJECT_B) }] : []), { headers: jsonHeaders() });
    }
    if (path === `/projects/${PROJECT_A}/merge_requests` || path === `/projects/${PROJECT_B}/merge_requests`) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path === `/projects/${PROJECT_A}/merge_requests/1`) return new Response(JSON.stringify({ id: 900, sha: "sha-a", changes_count: "1" }), { headers: jsonHeaders() });
    if (path === `/projects/${PROJECT_A}/merge_requests/1/diffs`) return new Response(JSON.stringify([{ old_path: "a.ts", new_path: "a.ts", diff: "@@ -1,1 +1,2 @@\n line\n+added\n" }]), { headers: jsonHeaders() });
    if (path === `/projects/${PROJECT_A}/merge_requests/1/notes`) return new Response(JSON.stringify([{ id: 5, author: { id: 1 }, system: false, created_at: "2026-01-03T00:00:00Z" }]), { headers: jsonHeaders() });
    if (path.endsWith("/repository/commits")) {
      commitsQuery.push(url.searchParams.get("since") ?? "");
      return new Response(JSON.stringify([{ id: "deadbeef", author_email: "juan@example.com", authored_date: "2026-01-02T00:00:00Z", stats: { additions: 2, deletions: 1 } }]), { headers: jsonHeaders() });
    }
    if (path.endsWith("/issues")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, commitsQuery };
}
afterEach(() => vi.unstubAllGlobals());

describe("collectGitlabSlice", () => {
  it("discovers projects, bounds commits by since, and converges across small-budget slices", async () => {
    const { commitsQuery } = setupFetch();
    const result = await runToCompletion(ownedInput(), 2);
    expect(result.slices).toBeGreaterThan(1);
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(1);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(2); // one per project
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(1);
    expect(result.coverage?.repositoryIds).toEqual([PROJECT_A, PROJECT_B].sort());
    expect(commitsQuery.every((q) => q === window.startInclusive)).toBe(true);
  });

  it("produces no duplicate event keys across slices", async () => {
    setupFetch();
    const result = await runToCompletion(ownedInput(), 1);
    const keys = result.events.map((e) => `${e.repositoryId}:${e.actorId}:${e.kind}:${e.eventId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("supports an explicit single-project scope", async () => {
    setupFetch();
    const result = await runToCompletion(explicitInput(PROJECT_A), 50);
    expect(result.coverage?.discovery).toBe("explicit_repositories");
    expect(result.coverage?.repositoryIds).toEqual([PROJECT_A]);
  });

  it("stops on budget exhaustion, never as a source_error", async () => {
    setupFetch();
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("budget");
  });

  it("classifies a 429 response as rate_limited with retryAfterSeconds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "15" } })));
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 10, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.stop?.stopKind).toBe("rate_limited");
    expect(result.stop?.retryAfterSeconds).toBe(15);
  });
});

describe("discoveryComplete (#1342)", () => {
  it("is false on the first slice", async () => {
    setupFetch();
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.discoveryComplete).toBe(false);
  });

  it("GITLAB_EXPANDING_OPERATIONS matches exactly the keys/prefixes whose processing calls registerRepo/ensureOp", () => {
    // Documents the call-site audit backing the constant: every key below is
    // either a non-expanding op or in the list.
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "projects:owned")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "projects:contributed")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "authored_merged")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "merge_requests:101")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "details:gitlab.com:project:101:mr:1")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "issues:101")).toBe(true);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "profile")).toBe(false);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "emails")).toBe(false);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "diffs:gitlab.com:project:101:mr:1")).toBe(false);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "notes:gitlab.com:project:101:mr:1")).toBe(false);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "commits:101")).toBe(false);
    expect(isExpandingOperation(GITLAB_EXPANDING_OPERATIONS, "resource_state_events:101:5")).toBe(false);
  });

  it("operationsKnown never grows once discoveryComplete is true, and it stays true", async () => {
    // Extends `setupFetch`'s fixture with one issue (PROJECT_A) closed by the
    // subject and linked to the seeded MR, so this run also exercises
    // issues:/resource_state_events: -- the one pair `setupFetch` leaves empty.
    const fetcher = vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      const path = url.pathname.replace(/^\/api\/v4/, "");
      if (path === "/user") return new Response(JSON.stringify({ id: 1, username: "juan", name: "Juan", avatar_url: null, email: "juan@example.com", confirmed_at: "2020-01-01T00:00:00Z" }), { headers: jsonHeaders() });
      if (path === "/user/emails") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
      if (path === "/merge_requests") return new Response(JSON.stringify([
        { id: 900, iid: 1, project_id: Number(PROJECT_A), author: { id: 1 }, state: "merged", merged_at: "2026-01-05T00:00:00Z", created_at: "2026-01-01T00:00:00Z", sha: "sha-a", description: "fix" },
      ]), { headers: jsonHeaders() });
      if (path === "/users/1/projects" || path === "/users/1/contributed_projects") {
        return new Response(JSON.stringify(path.endsWith("contributed_projects") ? [{ id: Number(PROJECT_B) }] : []), { headers: jsonHeaders() });
      }
      if (path === `/projects/${PROJECT_A}/merge_requests` || path === `/projects/${PROJECT_B}/merge_requests`) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
      if (path === `/projects/${PROJECT_A}/merge_requests/1`) return new Response(JSON.stringify({ id: 900, sha: "sha-a", changes_count: "1" }), { headers: jsonHeaders() });
      if (path === `/projects/${PROJECT_A}/merge_requests/1/diffs`) return new Response(JSON.stringify([{ old_path: "a.ts", new_path: "a.ts", diff: "@@ -1,1 +1,2 @@\n line\n+added\n" }]), { headers: jsonHeaders() });
      if (path === `/projects/${PROJECT_A}/merge_requests/1/notes`) return new Response(JSON.stringify([{ id: 5, author: { id: 1 }, system: false, created_at: "2026-01-03T00:00:00Z" }]), { headers: jsonHeaders() });
      if (path.endsWith("/repository/commits")) {
        return new Response(JSON.stringify([{ id: "deadbeef", author_email: "juan@example.com", authored_date: "2026-01-02T00:00:00Z", stats: { additions: 2, deletions: 1 } }]), { headers: jsonHeaders() });
      }
      if (path === `/projects/${PROJECT_A}/issues`) return new Response(JSON.stringify([{ iid: 5 }]), { headers: jsonHeaders() });
      if (path === `/projects/${PROJECT_B}/issues`) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
      if (path === `/projects/${PROJECT_A}/issues/5/resource_state_events`) {
        return new Response(JSON.stringify([{ id: 77, user: { id: 1 }, state: "closed", created_at: "2026-01-04T00:00:00Z", source_merge_request_id: 900 }]), { headers: jsonHeaders() });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetcher);

    let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
    const stagedKeys = new Set<string>();
    let sawDiscoveryComplete = false;
    let knownAtDiscoveryComplete = -1;
    for (let i = 0; i < 200; i++) {
      const result = await collectGitlabSlice(ownedInput(), credential, checkpoint, { maxRequests: 1, deadlineAt: Date.now() + 120_000 }, stagedKeys);
      for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
      checkpoint = result.checkpoint;
      if (sawDiscoveryComplete) {
        expect(result.discoveryComplete).toBe(true);
        expect(checkpoint.operations.length).toBe(knownAtDiscoveryComplete);
      } else if (result.discoveryComplete) {
        sawDiscoveryComplete = true;
        knownAtDiscoveryComplete = checkpoint.operations.length;
      }
      if (result.done) break;
      if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") {
        throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
      }
    }
    expect(sawDiscoveryComplete).toBe(true);
  });

  it("a legacy checkpoint with no flag starts as not discovered while an expanding op remains undone", async () => {
    const checkpoint: CollectorCheckpoint = {
      version: 1,
      operations: [
        { key: "profile", cursor: null, done: true },
        { key: "emails", cursor: null, done: true },
        { key: "authored_merged", cursor: null, done: true },
        { key: "projects:owned", cursor: null, done: false },
        { key: "projects:contributed", cursor: null, done: true },
      ],
      discovered: { repositoryIds: [] },
      state: { subjectId: "1", username: "juan", reasons: [] },
    };
    const result = await collectGitlabSlice(ownedInput(), credential, checkpoint, { maxRequests: 0, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.checkpoint.operations.find((op) => op.key === "projects:owned")?.done).toBe(false);
    expect(result.discoveryComplete).toBe(false);
  });
});
