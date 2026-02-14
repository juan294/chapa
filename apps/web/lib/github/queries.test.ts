import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContributionData } from "./queries";

describe("fetchContributionData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Authorization header when token is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            user: {
              login: "testuser",
              name: "Test",
              avatarUrl: "https://example.com/avatar.png",
              contributionsCollection: {
                contributionCalendar: {
                  totalContributions: 10,
                  weeks: [],
                },
                pullRequestContributions: { totalCount: 0, nodes: [] },
                pullRequestReviewContributions: { totalCount: 0 },
                issueContributions: { totalCount: 0 },
              },
              repositories: { totalCount: 0, nodes: [] },
            },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser", "gho_token123");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBe("Bearer gho_token123");
  });

  it("omits Authorization header when no token and no GITHUB_TOKEN", async () => {
    const original = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBeUndefined();

    if (original !== undefined) process.env.GITHUB_TOKEN = original;
  });

  it("falls back to GITHUB_TOKEN env var when no session token is provided", async () => {
    const original = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_ci_token_123";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            user: {
              login: "testuser",
              name: "Test",
              avatarUrl: "https://example.com/avatar.png",
              contributionsCollection: {
                contributionCalendar: { totalContributions: 0, weeks: [] },
                pullRequestContributions: { totalCount: 0, nodes: [] },
                pullRequestReviewContributions: { totalCount: 0 },
                issueContributions: { totalCount: 0 },
              },
              repositories: { totalCount: 0, nodes: [] },
            },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBe("Bearer ghp_ci_token_123");

    if (original !== undefined) {
      process.env.GITHUB_TOKEN = original;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it("prefers explicit token over GITHUB_TOKEN env var", async () => {
    const original = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_ci_fallback";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            user: {
              login: "testuser",
              name: "Test",
              avatarUrl: "https://example.com/avatar.png",
              contributionsCollection: {
                contributionCalendar: { totalContributions: 0, weeks: [] },
                pullRequestContributions: { totalCount: 0, nodes: [] },
                pullRequestReviewContributions: { totalCount: 0 },
                issueContributions: { totalCount: 0 },
              },
              repositories: { totalCount: 0, nodes: [] },
            },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser", "gho_session_token");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBe("Bearer gho_session_token");

    if (original !== undefined) {
      process.env.GITHUB_TOKEN = original;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it("logs HTTP errors with status code", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Bad credentials"),
      }),
    );

    const result = await fetchContributionData("testuser", "bad-token");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[github] GraphQL HTTP 401"),
    );
    consoleSpy.mockRestore();
  });

  it("logs GraphQL errors from the response body", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: "Could not resolve to a User" }],
            data: { user: null },
          }),
      }),
    );

    const result = await fetchContributionData("nonexistent");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[github] GraphQL errors for nonexistent:"),
      expect.arrayContaining([
        expect.objectContaining({ message: "Could not resolve to a User" }),
      ]),
    );
    consoleSpy.mockRestore();
  });

  it("sends separate DateTime and GitTimestamp variables in the query body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            user: {
              login: "testuser",
              name: "Test",
              avatarUrl: "https://example.com/avatar.png",
              contributionsCollection: {
                contributionCalendar: { totalContributions: 0, weeks: [] },
                pullRequestContributions: { totalCount: 0, nodes: [] },
                pullRequestReviewContributions: { totalCount: 0 },
                issueContributions: { totalCount: 0 },
              },
              repositories: { totalCount: 0, nodes: [] },
            },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser", "token");

    const [, opts] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(opts.body);

    // Query must declare GitTimestamp variables for Commit.history
    expect(body.query).toContain("$historySince: GitTimestamp!");
    expect(body.query).toContain("$historyUntil: GitTimestamp!");
    // And pass them to the history field
    expect(body.query).toContain("history(since: $historySince, until: $historyUntil)");
    // Variables must include both sets
    expect(body.variables).toHaveProperty("since");
    expect(body.variables).toHaveProperty("until");
    expect(body.variables).toHaveProperty("historySince");
    expect(body.variables).toHaveProperty("historyUntil");
    // Both pairs should have the same ISO string values
    expect(body.variables.historySince).toBe(body.variables.since);
    expect(body.variables.historyUntil).toBe(body.variables.until);
  });

  it("skips PR contribution nodes where pullRequest is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              user: {
                login: "testuser",
                name: "Test",
                avatarUrl: "https://example.com/avatar.png",
                contributionsCollection: {
                  contributionCalendar: { totalContributions: 5, weeks: [] },
                  pullRequestContributions: {
                    totalCount: 3,
                    nodes: [
                      { pullRequest: { additions: 10, deletions: 2, changedFiles: 3, merged: true } },
                      { pullRequest: null },
                      null,
                      { pullRequest: { additions: 5, deletions: 1, changedFiles: 1, merged: false } },
                    ],
                  },
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
              },
            },
          }),
      }),
    );

    const result = await fetchContributionData("testuser", "token");

    expect(result).not.toBeNull();
    // Should have 2 nodes (the null one filtered out)
    expect(result!.pullRequests.nodes).toHaveLength(2);
    expect(result!.pullRequests.nodes[0]!.additions).toBe(10);
    expect(result!.pullRequests.nodes[1]!.additions).toBe(5);
  });

  it("passes an AbortSignal with timeout to fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            user: {
              login: "testuser",
              name: "Test",
              avatarUrl: "https://example.com/avatar.png",
              contributionsCollection: {
                contributionCalendar: { totalContributions: 0, weeks: [] },
                pullRequestContributions: { totalCount: 0, nodes: [] },
                pullRequestReviewContributions: { totalCount: 0 },
                issueContributions: { totalCount: 0 },
              },
              repositories: { totalCount: 0, nodes: [] },
            },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser", "token");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.signal).toBeDefined();
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null when fetch is aborted (timeout)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(abortError),
    );

    const result = await fetchContributionData("testuser", "token");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[github] fetch error for testuser:"),
      expect.any(DOMException),
    );
    consoleSpy.mockRestore();
  });

  it("logs network/fetch errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await fetchContributionData("testuser", "token");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[github] fetch error for testuser:"),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
