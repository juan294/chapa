import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow, type NormalizedEngineeringEvent } from "@chapa/shared";
import { EMPTY_CHECKPOINT, type CollectorCheckpoint } from "@/lib/collection/plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectGitlabSlice } from "./evidence";

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
  let slices = 0;
  for (;;) {
    slices++;
    if (slices > 500) throw new Error("runaway slice loop");
    const result = await collectGitlabSlice(input, credential, checkpoint, { maxRequests, deadlineAt: Date.now() + 60_000 }, staged);
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
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.done).toBe(false);
    expect(result.stop?.stopKind).toBe("budget");
  });

  it("classifies a 429 response as rate_limited with retryAfterSeconds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "15" } })));
    const result = await collectGitlabSlice(ownedInput(), credential, EMPTY_CHECKPOINT, { maxRequests: 10, deadlineAt: Date.now() + 60_000 }, []);
    expect(result.stop?.stopKind).toBe("rate_limited");
    expect(result.stop?.retryAfterSeconds).toBe(15);
  });
});
