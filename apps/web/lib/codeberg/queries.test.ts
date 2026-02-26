import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import will fail until implementation exists (TDD RED)
import { fetchCodebergContributionData } from "./queries";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type FetchHandler = (
  url: string,
  init?: RequestInit,
) => Promise<{ status: number; json: () => Promise<unknown> }>;

let fetchCalls: { url: string; init?: RequestInit }[] = [];

function mockFetch(handler: FetchHandler) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    fetchCalls.push({ url, init });
    const result = await handler(url, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: result.json,
      text: async () => JSON.stringify(await result.json()),
    } as Response;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

// Factory helpers

function makeHeatmap(date: string, count: number) {
  return { timestamp: new Date(date).getTime() / 1000, contributions: count };
}

function makeRepo(
  fullName: string,
  owner: string,
  overrides: Record<string, unknown> = {},
) {
  const [, name] = fullName.split("/");
  return {
    id: Math.floor(Math.random() * 10000),
    name,
    full_name: fullName,
    private: false,
    fork: false,
    has_issues: true,
    stars_count: 0,
    forks_count: 0,
    watchers_count: 0,
    owner: { login: owner },
    ...overrides,
  };
}

function makePR(
  id: number,
  username: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    number: id,
    title: `PR #${id}`,
    state: "closed",
    merged: true,
    merged_at: "2026-02-01T12:00:00Z",
    additions: 50,
    deletions: 10,
    changed_files: 3,
    user: { login: username },
    ...overrides,
  };
}

function makeReview(id: number, state: string, username: string) {
  return {
    id,
    state,
    user: { login: username },
    submitted_at: "2026-02-01T12:00:00Z",
  };
}

function makeIssue(id: number, username: string) {
  return {
    id,
    number: id,
    state: "closed" as const,
    user: { login: username },
    closed_at: "2026-02-01T12:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchCodebergContributionData", () => {
  const profile = { displayName: "CB User", avatarUrl: "https://codeberg.org/avatar.png" };

  beforeEach(() => {
    fetchCalls = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null on heatmap auth failure (401)", async () => {
    mockFetch(async () => ({ status: 401, json: async () => ({}) }));

    const result = await fetchCodebergContributionData("testuser", "bad-token", profile);
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await fetchCodebergContributionData("testuser", "token123", profile);
    expect(result).toBeNull();
  });

  it("sends 'token' prefix in Authorization header", async () => {
    mockFetch(async () => ({ status: 200, json: async () => [] }));

    await fetchCodebergContributionData("testuser", "mytoken", profile);

    expect(fetchCalls.length).toBeGreaterThan(0);
    const firstCall = fetchCalls[0]!;
    expect(firstCall.init?.headers).toBeDefined();
    const headers = firstCall.init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("token mytoken");
  });

  it("fetches heatmap + repos + PRs + reviews + issues for a simple setup", async () => {
    const heatmapData = [
      makeHeatmap("2026-02-15T00:00:00Z", 5),
      makeHeatmap("2026-02-16T00:00:00Z", 3),
    ];

    const repoData = [makeRepo("cbuser/myrepo", "cbuser")];
    const prData = [makePR(1, "cbuser")];
    const otherPr = makePR(2, "otheruser", { merged: true });
    const reviewData = [makeReview(1, "APPROVED", "cbuser")];
    const issueData = [makeIssue(1, "cbuser")];

    mockFetch(async (url) => {
      // Heatmap
      if (url.includes("/users/cbuser/heatmap")) {
        return { status: 200, json: async () => heatmapData };
      }
      // User repos
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => repoData };
      }
      // PRs (merged)
      if (url.includes("/repos/cbuser/myrepo/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [...prData, otherPr] };
      }
      // Reviews for otheruser's PR
      if (url.includes("/reviews")) {
        return { status: 200, json: async () => reviewData };
      }
      // Issues
      if (url.includes("/repos/cbuser/myrepo/issues")) {
        return { status: 200, json: async () => issueData };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);

    expect(result).not.toBeNull();
    expect(result!.username).toBe("cbuser");
    expect(result!.heatmap.length).toBe(2);
    expect(result!.mergedPRs.length).toBe(1); // Only cbuser's merged PRs
    expect(result!.reviews.length).toBe(1);
    expect(result!.closedIssues).toBe(1);
    expect(result!.repos.length).toBe(1);
  });

  it("filters heatmap to scoring window", async () => {
    // System time: 2026-03-01. Scoring window = 365 days → since ~2025-03-01
    const oldEntry = makeHeatmap("2024-01-01T00:00:00Z", 10); // Outside window
    const recentEntry = makeHeatmap("2026-02-15T00:00:00Z", 5); // Inside window

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => [oldEntry, recentEntry] };
      }
      if (url.includes("/repos")) {
        return { status: 200, json: async () => [] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);

    expect(result).not.toBeNull();
    expect(result!.heatmap.length).toBe(1);
    expect(result!.heatmap[0]!.contributions).toBe(5);
  });

  it("caps merged PRs at MAX_PRS (100)", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser");
    // Create 120 merged PRs
    const prs = Array.from({ length: 120 }, (_, i) => makePR(i, "cbuser"));

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => prs };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.mergedPRs.length).toBeLessThanOrEqual(100);
  });

  it("only fetches issues for repos with has_issues=true", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repoWithIssues = makeRepo("cbuser/with-issues", "cbuser", { has_issues: true });
    const repoWithoutIssues = makeRepo("cbuser/no-issues", "cbuser", { has_issues: false });

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repoWithIssues, repoWithoutIssues] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [] };
      }
      if (url.includes("/issues")) {
        return { status: 200, json: async () => [makeIssue(1, "cbuser")] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    // Only 1 issue from the repo with issues enabled
    expect(result!.closedIssues).toBe(1);
    // Verify issues URL was only called for the repo with issues
    const issueUrls = fetchCalls.filter((c) => c.url.includes("/issues"));
    expect(issueUrls.length).toBe(1);
    expect(issueUrls[0]!.url).toContain("with-issues");
  });

  it("only counts social metrics from owned repos", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const ownedRepo = makeRepo("cbuser/owned", "cbuser", {
      stars_count: 10,
      forks_count: 5,
      watchers_count: 3,
    });
    const otherRepo = makeRepo("other/repo", "other", {
      stars_count: 100,
      forks_count: 50,
      watchers_count: 30,
    });

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [ownedRepo, otherRepo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    const owned = result!.repos.find((r) => r.fullName === "cbuser/owned");
    const other = result!.repos.find((r) => r.fullName === "other/repo");
    expect(owned!.isOwned).toBe(true);
    expect(owned!.starsCount).toBe(10);
    expect(other!.isOwned).toBe(false);
    expect(other!.starsCount).toBe(0); // Non-owned repos get 0 social metrics
  });

  it("filters PRs to only merged ones authored by user", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser");
    const myMergedPR = makePR(1, "cbuser", { merged: true });
    const myUnmergedPR = makePR(2, "cbuser", { merged: false });
    const otherUserPR = makePR(3, "otheruser", { merged: true });

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return {
          status: 200,
          json: async () => [myMergedPR, myUnmergedPR, otherUserPR],
        };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.mergedPRs.length).toBe(1);
    expect(result!.mergedPRs[0]!.id).toBe(1);
  });

  it("fetches reviews only from PRs not authored by user", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser");
    const myPR = makePR(1, "cbuser", { merged: true });
    const otherPR = makePR(2, "otheruser", { merged: true });

    const myReview = makeReview(1, "APPROVED", "cbuser");

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [myPR, otherPR] };
      }
      // Reviews for PR #2 (other user's PR)
      if (url.includes("/pulls/2/reviews")) {
        return { status: 200, json: async () => [myReview] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.reviews.length).toBe(1);
    // Should NOT fetch reviews for our own PR
    const reviewFetches = fetchCalls.filter((c) => c.url.includes("/reviews"));
    expect(reviewFetches.length).toBe(1);
    expect(reviewFetches[0]!.url).toContain("/pulls/2/reviews");
  });

  it("filters reviews to APPROVED and REQUEST_CHANGES only", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser");
    const otherPR = makePR(1, "otheruser", { merged: true });

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [otherPR] };
      }
      if (url.includes("/reviews")) {
        return {
          status: 200,
          json: async () => [
            makeReview(1, "APPROVED", "cbuser"),
            makeReview(2, "REQUEST_CHANGES", "cbuser"),
            makeReview(3, "COMMENT", "cbuser"),
            makeReview(4, "REQUEST_REVIEW", "cbuser"),
            makeReview(5, "APPROVED", "thirduser"), // Different user
          ],
        };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    // Only APPROVED + REQUEST_CHANGES by cbuser
    expect(result!.reviews.length).toBe(2);
  });

  it("sets repo commitCount from merged PR count as proxy", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser");
    const prs = [
      makePR(1, "cbuser"),
      makePR(2, "cbuser"),
      makePR(3, "cbuser"),
    ];

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => prs };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.repos[0]!.commitCount).toBe(3); // 3 merged PRs
  });

  it("encodes username in API URLs", async () => {
    mockFetch(async () => ({ status: 200, json: async () => [] }));

    await fetchCodebergContributionData("user name", "token123", profile);

    const heatmapCall = fetchCalls.find((c) => c.url.includes("/heatmap"));
    expect(heatmapCall).toBeDefined();
    expect(heatmapCall!.url).toContain("user%20name");
  });
});

describe("pagination", () => {
  const profile = { displayName: "CB User", avatarUrl: "https://codeberg.org/avatar.png" };

  beforeEach(() => {
    fetchCalls = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stops when result count < PAGE_SIZE", async () => {
    // Return fewer items than PAGE_SIZE (50) — should stop pagination
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repos = Array.from({ length: 10 }, (_, i) =>
      makeRepo(`cbuser/repo-${i}`, "cbuser"),
    );

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => repos }; // < 50 items = last page
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.repos.length).toBe(10);

    // Only 1 page of repos should be fetched (10 < 50)
    const repoFetches = fetchCalls.filter((c) => c.url.includes("/users/cbuser/repos"));
    expect(repoFetches.length).toBe(1);
  });

  it("stops at MAX_REPOS even when more pages available", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];

    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        // Return exactly PAGE_SIZE items → would normally trigger page 2
        // But MAX_REPOS=50=PAGE_SIZE, so maxItems cap stops pagination
        const repos = Array.from({ length: 50 }, (_, i) =>
          makeRepo(`cbuser/repo-${i}`, "cbuser"),
        );
        return { status: 200, json: async () => repos };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [] };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    expect(result!.repos.length).toBe(50);

    // Only 1 page fetched because maxItems cap (50) reached
    const repoFetches = fetchCalls.filter((c) => c.url.includes("/users/cbuser/repos"));
    expect(repoFetches.length).toBe(1);
  });

  it("accumulates items across pages for endpoints without maxItems cap", async () => {
    const heatmap = [makeHeatmap("2026-02-15T00:00:00Z", 1)];
    const repo = makeRepo("cbuser/repo", "cbuser", { has_issues: true });

    let issueCallCount = 0;
    mockFetch(async (url) => {
      if (url.includes("/heatmap")) {
        return { status: 200, json: async () => heatmap };
      }
      if (url.includes("/users/cbuser/repos")) {
        return { status: 200, json: async () => [repo] };
      }
      if (url.includes("/pulls") && !url.includes("/reviews")) {
        return { status: 200, json: async () => [] };
      }
      if (url.includes("/issues")) {
        issueCallCount++;
        if (issueCallCount === 1) {
          // Page 1: exactly PAGE_SIZE items → triggers page 2
          const issues = Array.from({ length: 50 }, (_, i) =>
            makeIssue(i, "cbuser"),
          );
          return { status: 200, json: async () => issues };
        }
        // Page 2: fewer items → stops
        const issues = Array.from({ length: 5 }, (_, i) =>
          makeIssue(100 + i, "cbuser"),
        );
        return { status: 200, json: async () => issues };
      }
      return { status: 200, json: async () => [] };
    });

    const result = await fetchCodebergContributionData("cbuser", "token123", profile);
    expect(result).not.toBeNull();
    // 50 + 5 = 55 closed issues across 2 pages
    expect(result!.closedIssues).toBe(55);

    const issueFetches = fetchCalls.filter((c) => c.url.includes("/issues"));
    expect(issueFetches.length).toBe(2);
  });
});
