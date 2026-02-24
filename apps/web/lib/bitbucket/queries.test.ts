import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchBitbucketContributionData } from "./queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fetchCalls: { url: string; init?: RequestInit }[] = [];

function mockFetch(
  handler: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ status: number; json: () => Promise<unknown> }>,
) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
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

function paginated<T>(values: T[], next?: string) {
  return {
    values,
    page: 1,
    size: values.length,
    pagelen: values.length,
    ...(next ? { next } : {}),
  };
}

function makeWorkspace(slug: string) {
  return {
    workspace: { slug, name: slug },
    permission: "member",
  };
}

function makeRepo(
  workspace: string,
  slug: string,
  owner = "someone",
  hasIssues = true,
) {
  return {
    slug,
    full_name: `${workspace}/${slug}`,
    is_private: false,
    has_issues: hasIssues,
    owner: { username: owner },
    links: {
      forks: {
        href: `https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}/forks`,
      },
    },
  };
}

function makeCommit(hash: string, date: string, username = "bbuser") {
  return {
    hash,
    date: `${date}T12:00:00.000Z`,
    message: "commit",
    author: { raw: "User <u@e.com>", user: { username } },
  };
}

function makePR(id: number, username = "bbuser") {
  return {
    id,
    title: `PR #${id}`,
    state: "MERGED",
    author: { username },
    created_on: "2025-06-01T00:00:00.000Z",
    updated_on: "2025-06-02T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchBitbucketContributionData", () => {
  beforeEach(() => {
    fetchCalls = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token123",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).toBeNull();
  });

  it("returns null on 401 (invalid token)", async () => {
    mockFetch(async () => ({
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }));

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "bad-token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).toBeNull();
  });

  it("sends Bearer token in Authorization header", async () => {
    mockFetch(async () => ({
      status: 200,
      json: async () => paginated([]),
    }));

    await fetchBitbucketContributionData("bbuser", "mytoken", {
      displayName: "BB User",
      avatarUrl: "https://bb.org/avatar.png",
    });

    expect(fetchCalls.length).toBeGreaterThan(0);
    const firstCall = fetchCalls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall!.init?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer mytoken",
      }),
    );
  });

  it("follows pagination (next links)", async () => {
    let callCount = 0;

    mockFetch(async (url) => {
      // Workspace endpoint
      if (url.includes("/user/permissions/workspaces")) {
        if (callCount === 0) {
          callCount++;
          return {
            status: 200,
            json: async () => ({
              ...paginated(
                [makeWorkspace("ws1")],
                "https://api.bitbucket.org/2.0/user/permissions/workspaces?page=2",
              ),
            }),
          };
        }
        return {
          status: 200,
          json: async () => paginated([makeWorkspace("ws2")]),
        };
      }
      // Default: empty paginated response
      return { status: 200, json: async () => paginated([]) };
    });

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    // Should have followed the next link (2 workspace fetches + 2 repo fetches)
    const workspaceFetches = fetchCalls.filter((c) =>
      c.url.includes("/user/permissions/workspaces"),
    );
    expect(workspaceFetches.length).toBe(2);
    expect(result).not.toBeNull();
  });

  it("caps at MAX_WORKSPACES (10)", async () => {
    const manyWorkspaces = Array.from({ length: 15 }, (_, i) =>
      makeWorkspace(`ws${i}`),
    );

    mockFetch(async (url) => {
      if (url.includes("/user/permissions/workspaces")) {
        return { status: 200, json: async () => paginated(manyWorkspaces) };
      }
      return { status: 200, json: async () => paginated([]) };
    });

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).not.toBeNull();
    // Should fetch repos for only 10 workspaces
    const repoFetches = fetchCalls.filter(
      (c) =>
        c.url.includes("/repositories/") &&
        !c.url.includes("/commits") &&
        !c.url.includes("/pullrequests") &&
        !c.url.includes("/forks") &&
        !c.url.includes("/issues") &&
        !c.url.includes("/diffstat") &&
        !c.url.includes("/activity"),
    );
    expect(repoFetches.length).toBeLessThanOrEqual(10);
  });

  it("caps at MAX_REPOS (50)", async () => {
    const manyRepos = Array.from({ length: 60 }, (_, i) =>
      makeRepo("ws1", `repo${i}`),
    );

    mockFetch(async (url) => {
      if (url.includes("/user/permissions/workspaces")) {
        return {
          status: 200,
          json: async () => paginated([makeWorkspace("ws1")]),
        };
      }
      if (url.includes("/repositories/ws1") && !url.includes("/commits") && !url.includes("/pullrequests") && !url.includes("/forks") && !url.includes("/issues")) {
        return { status: 200, json: async () => paginated(manyRepos) };
      }
      if (url.includes("/commits")) {
        return { status: 200, json: async () => paginated([]) };
      }
      if (url.includes("/pullrequests")) {
        return { status: 200, json: async () => paginated([]) };
      }
      return { status: 200, json: async () => paginated([]) };
    });

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).not.toBeNull();
    expect(result!.repos.length).toBeLessThanOrEqual(50);
  });

  it("returns complete data for a simple workspace with one repo", async () => {
    mockFetch(async (url) => {
      if (url.includes("/user/permissions/workspaces")) {
        return {
          status: 200,
          json: async () => paginated([makeWorkspace("myws")]),
        };
      }
      if (
        url.includes("/repositories/myws") &&
        !url.includes("/commits") &&
        !url.includes("/pullrequests") &&
        !url.includes("/forks") &&
        !url.includes("/issues") &&
        !url.includes("/diffstat") &&
        !url.includes("/activity")
      ) {
        return {
          status: 200,
          json: async () =>
            paginated([makeRepo("myws", "my-repo", "bbuser")]),
        };
      }
      if (url.includes("/commits")) {
        return {
          status: 200,
          json: async () =>
            paginated([
              makeCommit("abc1", "2025-06-01"),
              makeCommit("abc2", "2025-06-02"),
            ]),
        };
      }
      if (url.includes("/pullrequests") && !url.includes("/diffstat") && !url.includes("/activity")) {
        if (url.includes("state=MERGED")) {
          return {
            status: 200,
            json: async () => paginated([makePR(1)]),
          };
        }
        // All merged PRs (for review counting)
        return {
          status: 200,
          json: async () => paginated([makePR(1)]),
        };
      }
      if (url.includes("/diffstat")) {
        return {
          status: 200,
          json: async () =>
            paginated([
              {
                status: "modified",
                lines_added: 50,
                lines_removed: 10,
                new: { path: "file.ts" },
              },
            ]),
        };
      }
      if (url.includes("/activity")) {
        return {
          status: 200,
          json: async () =>
            paginated([
              {
                approval: {
                  user: { username: "bbuser" },
                  date: "2025-06-01",
                },
              },
            ]),
        };
      }
      if (url.includes("/forks")) {
        return {
          status: 200,
          json: async () => ({ ...paginated([{}, {}]), size: 2 }),
        };
      }
      if (url.includes("/issues")) {
        return {
          status: 200,
          json: async () => paginated([{ id: 1, state: "resolved" }]),
        };
      }
      return { status: 200, json: async () => paginated([]) };
    });

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).not.toBeNull();
    expect(result!.username).toBe("bbuser");
    expect(result!.commits).toHaveLength(2);
    expect(result!.mergedPRs).toHaveLength(1);
    expect(result!.mergedPRs[0]!.diffstat).toHaveLength(1);
    expect(result!.repos).toHaveLength(1);
    expect(result!.repos[0]!.isOwned).toBe(true);
  });

  it("handles repos with issues disabled (has_issues: false)", async () => {
    mockFetch(async (url) => {
      if (url.includes("/user/permissions/workspaces")) {
        return {
          status: 200,
          json: async () => paginated([makeWorkspace("ws")]),
        };
      }
      if (
        url.includes("/repositories/ws") &&
        !url.includes("/commits") &&
        !url.includes("/pullrequests") &&
        !url.includes("/forks") &&
        !url.includes("/issues") &&
        !url.includes("/diffstat") &&
        !url.includes("/activity")
      ) {
        return {
          status: 200,
          json: async () =>
            paginated([makeRepo("ws", "no-issues", "other", false)]),
        };
      }
      if (url.includes("/commits")) {
        return { status: 200, json: async () => paginated([makeCommit("c1", "2025-06-01")]) };
      }
      if (url.includes("/pullrequests")) {
        return { status: 200, json: async () => paginated([]) };
      }
      if (url.includes("/issues")) {
        // Should NOT be called for repos without issue tracker
        throw new Error("Should not fetch issues for repo without tracker");
      }
      return { status: 200, json: async () => paginated([]) };
    });

    const result = await fetchBitbucketContributionData(
      "bbuser",
      "token",
      { displayName: "BB User", avatarUrl: "https://bb.org/avatar.png" },
    );

    expect(result).not.toBeNull();
    expect(result!.closedIssues).toBe(0);
  });
});
