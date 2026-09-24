import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, engineeringEventKey, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectBitbucketSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const WORKSPACE = "{22222222-2222-2222-2222-222222222222}";
const REPO_A = "{33333333-3333-3333-3333-333333333333}";
const REPO_B = "{44444444-4444-4444-4444-444444444444}";
const PROFILE = { uuid: "{11111111-1111-1111-1111-111111111111}", account_id: "acc1", display_name: "Juan" };

function ownedInput(): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "juan" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(repositoryId: string): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "bitbucket", host: "bitbucket.org", login: "juan" }, window, scope: { discovery: "explicit_repositories", repositoryIds: [repositoryId], eventKinds: [] } };
}

async function runToCompletion(input: SourceContextInput, maxRequests: number) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  const stagedKeys = new Set<string>();
  let slices = 0;
  for (;;) {
    slices++;
    if (slices > 500) throw new Error("runaway slice loop");
    const result = await collectBitbucketSlice(input, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, stagedKeys);
    for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
    staged = [...staged, ...result.events];
    checkpoint = result.checkpoint;
    if (result.done) return { events: staged, slices, coverage: result.coverage };
    if (result.stop && result.stop.stopKind !== "budget" && result.stop.stopKind !== "deadline") throw new Error(`Unexpected stop: ${JSON.stringify(result.stop)}`);
  }
}

function setupFetch(options: { readonly repos?: readonly string[]; readonly commitsQuery?: string[] } = {}) {
  const repos = options.repos ?? [REPO_A, REPO_B];
  const commitsQuery: string[] = options.commitsQuery ?? [];
  const fetcher = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/2\.0/, "");
    if (path === "/user") return new Response(JSON.stringify(PROFILE), { status: 200 });
    if (path === "/user/workspaces") return new Response(JSON.stringify({ values: [{ workspace: { uuid: WORKSPACE } }], next: null }), { status: 200 });
    if (path === `/repositories/${encodeURIComponent(WORKSPACE)}`) {
      return new Response(JSON.stringify({ values: repos.map((uuid) => ({ uuid, full_name: `juan/${uuid}` })), next: null }), { status: 200 });
    }
    if (path.endsWith("/commits")) {
      const repositoryId = decodeURIComponent(path.split("/")[3]!);
      commitsQuery.push(url.searchParams.get("q") ?? "");
      return new Response(JSON.stringify({ values: [
        { hash: "abcdef1234567890abcdef1234567890abcdef12", date: "2026-01-01T00:00:00.000Z", author: { user: { uuid: PROFILE.uuid } } },
        { hash: "1234567890abcdef1234567890abcdef12345678", date: "2026-01-02T00:00:00.000Z", author: { user: { uuid: "{99999999-9999-9999-9999-999999999999}" } } },
      ], next: null }), { status: 200 });
      void repositoryId;
    }
    if (path.endsWith("/pullrequests")) {
      // The real API caps pullrequests pagelen at 50 and answers 400 above it
      // (production, 2026-09-24: every Bitbucket job stopped here).
      if (Number(url.searchParams.get("pagelen") ?? "10") > 50) return new Response(JSON.stringify({ type: "error", error: { message: "Invalid pagelen" } }), { status: 400 });
      return new Response(JSON.stringify({ values: [
        { id: 7, state: "MERGED", author: { uuid: PROFILE.uuid }, created_on: "2026-01-01T00:00:00.000Z", description: "fix it" },
      ], next: null }), { status: 200 });
    }
    if (path.endsWith("/activity")) {
      return new Response(JSON.stringify({ values: [
        { update: { state: "MERGED", date: "2026-01-05T00:00:00.000Z" } },
        { comment: { id: 55, user: { uuid: PROFILE.uuid }, created_on: "2026-01-04T00:00:00.000Z", deleted: false } },
      ], next: null }), { status: 200 });
    }
    if (path.endsWith("/diffstat")) {
      return new Response(null, { status: 302, headers: { location: "https://api.bitbucket.org/2.0/repositories/workspace/project/diffstat/aaaaaaa..bbbbbbb" } });
    }
    if (path.includes("/diffstat/aaaaaaa..bbbbbbb")) {
      return new Response(JSON.stringify({ values: [{ old: { path: "a.ts" }, new: { path: "a.ts" }, lines_added: 3, lines_removed: 1 }], next: null }), { status: 200 });
    }
    void init;
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, commitsQuery };
}
afterEach(() => vi.unstubAllGlobals());

describe("collectBitbucketSlice", () => {
  it("discovers workspaces and repositories, then converges to a stable event set across small-budget slices", async () => {
    const { commitsQuery } = setupFetch();
    const result = await runToCompletion(ownedInput(), 2);
    expect(result.slices).toBeGreaterThan(1);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(2); // one per repo, subject-authored only
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(2);
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2); // one comment per repo's single PR
    expect(result.coverage?.repositoryIds).toEqual([REPO_A, REPO_B].sort());
    expect(commitsQuery.every((q) => q.startsWith("date>="))).toBe(true);
    expect(commitsQuery.every((q) => q.includes(window.startInclusive))).toBe(true);
  });

  it("produces no duplicate event keys across slices", async () => {
    setupFetch();
    const result = await runToCompletion(ownedInput(), 1);
    const keys = result.events.map((e) => `${e.repositoryId}:${e.actorId}:${e.kind}:${e.eventId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("converges to complete file measurements even at maxRequests: 1, never reporting partial_files for available data", async () => {
    setupFetch({ repos: [REPO_A] });
    const result = await runToCompletion(explicitInput(REPO_A), 1);
    expect(result.slices).toBeGreaterThan(1);
    const accepted = result.events.find((e) => e.kind === "accepted_change")!;
    expect(accepted.measurements.changedFiles).toMatchObject({ status: "observed", value: ["a.ts"] });
    expect(accepted.measurements.additions).toMatchObject({ status: "observed", value: 3 });
    expect(accepted.measurements.deletions).toMatchObject({ status: "observed", value: 1 });
    // The bug this regresses: a tight per-slice budget used to abandon the
    // diffstat redirect + diff pages every retry (never persisting progress),
    // so file measurements landed unknown/partial_files even though the data
    // was fully available. They must land complete here instead.
    expect(result.coverage?.reasonCodes).not.toContain("partial_files");
  });

  it("restarts a list from page 1 when a saved cursor carries a different page size (production 2026-09-24: pre-v4.0.1 cursors kept pagelen=100)", async () => {
    const { fetcher } = setupFetch({ repos: [REPO_A] });
    let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
    const stagedKeys = new Set<string>();
    const prKey = `pullrequests:${REPO_A}`;
    for (let i = 0; i < 50 && !checkpoint.operations.some((op) => op.key === prKey); i++) {
      const result = await collectBitbucketSlice(explicitInput(REPO_A), credential, checkpoint, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
      checkpoint = result.checkpoint;
    }
    const stale = `/2.0/repositories/%7B%7D/${encodeURIComponent(REPO_A)}/pullrequests?pagelen=100&state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED&page=3`;
    checkpoint = { ...checkpoint, operations: checkpoint.operations.map((op) => (op.key === prKey ? { ...op, done: false, cursor: stale } : op)) };
    fetcher.mockClear();

    const result = await collectBitbucketSlice(explicitInput(REPO_A), credential, checkpoint, { maxRequests: 50, deadlineAt: Date.now() + 60_000 }, stagedKeys);

    const prUrls = fetcher.mock.calls.map(([u]) => new URL(String(u))).filter((u) => u.pathname.endsWith("/pullrequests"));
    expect(prUrls).toHaveLength(1);
    expect(prUrls[0]!.searchParams.get("pagelen")).toBe("50");
    expect(prUrls[0]!.searchParams.get("page")).toBeNull();
    expect(result.stop).toBeFalsy();
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(1);
  });

  it("never stores an absolute (host-carrying) URL as a checkpoint cursor", async () => {
    setupFetch();
    let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
    let staged: NormalizedEngineeringEvent[] = [];
    const stagedKeys = new Set<string>();
    for (let slices = 0; slices < 500; slices++) {
      const result = await collectBitbucketSlice(ownedInput(), credential, checkpoint, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, stagedKeys);
      for (const op of result.checkpoint.operations) {
        if (op.cursor === null) continue;
        expect(op.cursor).not.toContain("https://");
        expect(op.cursor).not.toContain("http://");
      }
      for (const event of result.events) stagedKeys.add(engineeringEventKey(event));
      staged = [...staged, ...result.events];
      checkpoint = result.checkpoint;
      if (result.done) break;
    }
  });

  it("absorbs a not_accessible fan-out item (a repo that went private mid-collection) as a soft reason: the job completes with partial coverage and the other repo's data is still collected", async () => {
    setupFetch({ repos: [REPO_A, REPO_B] });
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      const path = url.pathname.replace(/^\/2\.0/, "");
      if (path.includes(encodeURIComponent(REPO_A)) && (path.endsWith("/commits") || path.endsWith("/pullrequests"))) {
        return new Response(JSON.stringify({ type: "error", error: { message: "repository access lost" } }), { status: 403 });
      }
      if (path === "/user") return new Response(JSON.stringify(PROFILE), { status: 200 });
      if (path === "/user/workspaces") return new Response(JSON.stringify({ values: [{ workspace: { uuid: WORKSPACE } }], next: null }), { status: 200 });
      if (path === `/repositories/${encodeURIComponent(WORKSPACE)}`) return new Response(JSON.stringify({ values: [REPO_A, REPO_B].map((uuid) => ({ uuid, full_name: `juan/${uuid}` })), next: null }), { status: 200 });
      if (path.endsWith("/commits")) return new Response(JSON.stringify({ values: [{ hash: "abcdef1234567890abcdef1234567890abcdef12", date: "2026-01-01T00:00:00.000Z", author: { user: { uuid: PROFILE.uuid } } }], next: null }), { status: 200 });
      if (path.endsWith("/pullrequests")) return new Response(JSON.stringify({ values: [] }), { status: 200 });
      throw new Error(`Unexpected request: ${path}`);
    }));
    const result = await runToCompletion(ownedInput(), 200);
    expect(result.coverage?.status).toBe("partial");
    expect(result.coverage?.reasonCodes).toContain("not_accessible");
    expect(result.events.filter((e) => e.kind === "authored_commit").every((e) => e.repositoryId === REPO_B)).toBe(true);
    expect(result.events.some((e) => e.repositoryId === REPO_B)).toBe(true);
  });

  it("supports the juan294 single-repo explicit shape without enumerating workspaces", async () => {
    const { fetcher } = setupFetch({ repos: [REPO_A] });
    const result = await runToCompletion(explicitInput(REPO_A), 50);
    expect(result.coverage?.discovery).toBe("explicit_repositories");
    expect(result.coverage?.repositoryIds).toEqual([REPO_A]);
    expect(fetcher.mock.calls.some(([u]) => String(u).includes("/user/workspaces"))).toBe(false);
  });

  it("stops on budget exhaustion, never as a source_error", async () => {
    setupFetch();
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("budget");
  });

  it("classifies a 429 response as rate_limited with retryAfterSeconds", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "30" } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await collectBitbucketSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 10, deadlineAt: Date.now() + 60_000 }, new Set());
    expect(result.stop?.stopKind).toBe("rate_limited");
    expect(result.stop?.retryAfterSeconds).toBe(30);
  });
});
