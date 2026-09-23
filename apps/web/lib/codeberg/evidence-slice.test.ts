import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectCodebergSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const credential = { token: "tok" };
const REPO_A = "1"; const REPO_B = "2";

function ownedInput(): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "codeberg", host: "codeberg.org", login: "juan" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}
function explicitInput(repositoryId: string): SourceContextInput {
  return { owner: "juan", requestedSource: { provider: "codeberg", host: "codeberg.org", login: "juan" }, window, scope: { discovery: "explicit_repositories", repositoryIds: [repositoryId], eventKinds: [] } };
}

async function runToCompletion(input: SourceContextInput, maxRequests: number) {
  let checkpoint: CollectorCheckpoint = EMPTY_CHECKPOINT;
  let staged: NormalizedEngineeringEvent[] = [];
  let slices = 0;
  for (;;) {
    slices++;
    if (slices > 500) throw new Error("runaway slice loop");
    const result = await collectCodebergSlice(input, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, staged);
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
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (path === "/user") return new Response(JSON.stringify({ id: 1, login: "juan", full_name: "Juan", avatar_url: null }), { headers: jsonHeaders() });
    if (path === "/users/juan/repos") return new Response(JSON.stringify([{ id: Number(REPO_A), full_name: `juan/${REPO_A}` }]), { headers: jsonHeaders() });
    if (path === "/user/repos") return new Response(JSON.stringify([{ id: Number(REPO_B), full_name: `juan/${REPO_B}` }]), { headers: jsonHeaders() });
    if (path === "/users/juan/activities/feeds") return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    if (path.endsWith("/commits")) {
      commitsQuery.push(url.searchParams.get("since") ?? "");
      return new Response(JSON.stringify([{ sha: "abcdef1234567890abcdef1234567890abcdef12", author: { id: 1 }, commit: { author: { date: "2026-01-01T00:00:00Z" } }, stats: { additions: 1, deletions: 0 } }]), { headers: jsonHeaders() });
    }
    if (path.endsWith("/pulls")) {
      return new Response(JSON.stringify([{ number: 9, user: { id: 1 }, merged: true, merged_at: "2026-01-05T00:00:00Z", created_at: "2026-01-01T00:00:00Z", body: "desc", merge_commit_sha: "1234567890abcdef1234567890abcdef12345678", head: { sha: "headsha1234567890abcdef1234567890abcdef" }, changed_files: 1, additions: 2, deletions: 0 }]), { headers: jsonHeaders() });
    }
    if (path.endsWith("/git/refs/pull/9/head")) return new Response(JSON.stringify([{ ref: "refs/pull/9/head", object: { sha: "headsha1234567890abcdef1234567890abcdef" } }]), { headers: jsonHeaders() });
    if (path.endsWith("/pulls/9/files")) return new Response(JSON.stringify([{ filename: "a.ts", additions: 2, deletions: 0 }]), { headers: jsonHeaders() });
    if (path.endsWith("/pulls/9/reviews")) return new Response(JSON.stringify([{ id: 4, user: { id: 1 }, state: "APPROVED", submitted_at: "2026-01-03T00:00:00Z", commit_id: "abc" }]), { headers: jsonHeaders() });
    if (path.endsWith("/issues")) return new Response(JSON.stringify([]), { headers: jsonHeaders() });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, commitsQuery };
}
afterEach(() => vi.unstubAllGlobals());

describe("collectCodebergSlice", () => {
  it("discovers repos across own/user/feeds, bounds commits by since, and converges across small-budget slices", async () => {
    const { commitsQuery } = setupFetch();
    const result = await runToCompletion(ownedInput(), 2);
    expect(result.slices).toBeGreaterThan(1);
    expect(result.events.filter((e) => e.kind === "authored_commit")).toHaveLength(2);
    expect(result.events.filter((e) => e.kind === "accepted_change")).toHaveLength(2);
    expect(result.events.filter((e) => e.kind === "review")).toHaveLength(2);
    expect(result.coverage?.repositoryIds).toEqual([REPO_A, REPO_B].sort());
    expect(commitsQuery.every((q) => q === window.startInclusive)).toBe(true);
  });

  it("produces no duplicate event keys across slices", async () => {
    setupFetch();
    const result = await runToCompletion(ownedInput(), 1);
    const keys = result.events.map((e) => `${e.repositoryId}:${e.actorId}:${e.kind}:${e.eventId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("supports an explicit single-repository scope", async () => {
    setupFetch();
    const result = await runToCompletion(explicitInput(REPO_A), 50);
    expect(result.coverage?.discovery).toBe("explicit_repositories");
    expect(result.coverage?.repositoryIds).toEqual([REPO_A]);
  });

  it("stops on budget exhaustion, never as a source_error", async () => {
    setupFetch();
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("budget");
  });

  it("classifies a 429 response as rate_limited with retryAfterSeconds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "20" } })));
    const result = await collectCodebergSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 10, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.stop?.stopKind).toBe("rate_limited");
    expect(result.stop?.retryAfterSeconds).toBe(20);
  });
});
