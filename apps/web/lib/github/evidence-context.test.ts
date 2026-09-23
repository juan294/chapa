import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { createSourceContext } from "@/lib/platform/source-context";
import { collectGitHubSlice } from "./evidence";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const input = { owner: "alice", requestedSource: { provider: "github" as const, host: "github.com", login: "alice" }, window,
  scope: { discovery: "owned_and_contributed" as const, repositoryIds: [], eventKinds: ["accepted_change"] } };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("GitHub collector uses the bound credential", () => {
  it("does not replace explicitly anonymous collection with a later server token", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-context-secret"); vi.stubEnv("GITHUB_TOKEN", undefined);
    const context = createSourceContext(input, { kind: "github" });
    vi.stubEnv("GITHUB_TOKEN", "later-server-token");
    const fetcher = vi.fn(async () => new Response("", { status: 401 })); vi.stubGlobal("fetch", fetcher);
    await context.collect((token) => collectGitHubSlice(input, { token: token ?? null }, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, []));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).not.toHaveProperty("Authorization");
  });
  it("keeps the captured server credential when the environment rotates before collection", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-context-secret"); vi.stubEnv("GITHUB_TOKEN", "original-server-token");
    const context = createSourceContext(input, { kind: "github" });
    vi.stubEnv("GITHUB_TOKEN", "rotated-server-token");
    const fetcher = vi.fn(async () => new Response("", { status: 401 })); vi.stubGlobal("fetch", fetcher);
    await context.collect((token) => collectGitHubSlice(input, { token: token ?? null }, EMPTY_CHECKPOINT, { maxRequests: 1, deadlineAt: Date.now() + 60_000 }, []));
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toHaveProperty("Authorization", "Bearer original-server-token");
  });
});
