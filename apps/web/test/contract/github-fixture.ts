import { vi } from "vitest";

/** Synthetic GitHub edge only; real loopback database HTTP stays intact. */
export function stubLegacyGitHub(handle: string, prsMergedCount = 904, commitsTotal = 15533) {
  const localFetch = globalThis.fetch;
  const mocked = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "127.0.0.1") return localFetch(input, init);
    if (url.origin !== "https://api.github.com" || url.pathname !== "/graphql") throw new Error("Unexpected contract HTTP destination");
    return new Response(JSON.stringify({ data: { user: { login: handle, name: "Contract User", avatarUrl: "",
      contributionsCollection: { contributionCalendar: { totalContributions: commitsTotal, weeks: [] }, pullRequestContributions: { totalCount: 143, nodes: [] },
        pullRequestReviewContributions: { totalCount: 16 }, issueContributions: { totalCount: 5096 } }, repositories: { totalCount: 0, nodes: [] } },
      search: { issueCount: prsMergedCount } } }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", mocked);
  return mocked;
}
