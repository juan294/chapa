import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { EMPTY_CHECKPOINT } from "./plan";
import type { SourceContextInput } from "@/lib/platform/source-context";
import { collectSourceSlice } from "./collect-source-slice";

const window = createScoringWindow("2026-09-05T12:00:00Z");
const budget = { maxRequests: 5, deadlineAt: Date.now() + 60_000 };

function inputFor(provider: SourceContextInput["requestedSource"]["provider"]): SourceContextInput {
  return { owner: "juan", requestedSource: { provider, host: `${provider}.example`, login: "juan" }, window, scope: { discovery: "owned_and_contributed", repositoryIds: [], eventKinds: [] } };
}

afterEach(() => vi.unstubAllGlobals());

describe("collectSourceSlice", () => {
  it("dispatches github to collectGitHubSlice (a request against the GitHub GraphQL endpoint)", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { user: null } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await collectSourceSlice(inputFor("github"), { token: null }, EMPTY_CHECKPOINT, budget, new Set());
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/graphql", expect.anything());
  });

  it("dispatches bitbucket to collectBitbucketSlice (a request against the Bitbucket REST API)", async () => {
    const fetcher = vi.fn(async (_input: unknown) => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await collectSourceSlice(inputFor("bitbucket"), { token: "tok" }, EMPTY_CHECKPOINT, budget, new Set());
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("api.bitbucket.org");
  });

  it("dispatches gitlab to collectGitlabSlice (a request against the GitLab REST API)", async () => {
    const fetcher = vi.fn(async (_input: unknown) => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await collectSourceSlice(inputFor("gitlab"), { token: "tok" }, EMPTY_CHECKPOINT, budget, new Set());
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("gitlab.com/api/v4");
  });

  it("dispatches codeberg to collectCodebergSlice (a request against the Codeberg REST API)", async () => {
    const fetcher = vi.fn(async (_input: unknown) => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await collectSourceSlice(inputFor("codeberg"), { token: "tok" }, EMPTY_CHECKPOINT, budget, new Set());
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("codeberg.org/api/v1");
  });
});
