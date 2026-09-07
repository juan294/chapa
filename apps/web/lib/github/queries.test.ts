import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchContributionData } from "./queries";
import { githubUserNotFound, isGitHubUserNotFound } from "./not-found";
import { expectFound } from "@/lib/test-helpers/found";
import { _setRetryDelayFn } from "@/lib/utils/fetch-retry";

describe("fetchContributionData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Skip retry delays so tests don't hang
    _setRetryDelayFn(() => Promise.resolve());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
    vi.stubEnv("GITHUB_TOKEN", undefined);

    // Silence expected 401 console.error from the error-handling code path
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser");

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers["Authorization"]).toBeUndefined();

    consoleSpy.mockRestore();
  });

  it("falls back to GITHUB_TOKEN env var when no session token is provided", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_ci_token_123");

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
  });

  it("prefers explicit token over GITHUB_TOKEN env var", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_ci_fallback");

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
    // The provider's error body is never echoed into logs (S08).
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
      "[github] GraphQL errors for nonexistent",
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

  // ---------------------------------------------------------------------------
  // Authoritative merged-PR search (2026-07-07 scoring-integrity-contract)
  // ---------------------------------------------------------------------------

  it("builds mergedPrSearch as author:<login> is:pr is:merged created:<since>..<until> (YYYY-MM-DD)", async () => {
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
            search: { issueCount: 904 },
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContributionData("testuser", "token");

    const [, opts] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(opts.body);
    expect(body.variables.mergedPrSearch).toMatch(
      /^author:testuser is:pr is:merged created:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("sets mergedPrTotalCount from search.issueCount", async () => {
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
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                  pullRequestContributions: { totalCount: 143, nodes: [] },
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
              },
              search: { issueCount: 904 },
            },
          }),
      }),
    );

    const result = expectFound(await fetchContributionData("testuser", "token"));
    expect(result.mergedPrTotalCount).toBe(904);
  });

  it("defaults mergedPrTotalCount to 0 when search is missing from the response", async () => {
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
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                  pullRequestContributions: { totalCount: 0, nodes: [] },
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
              },
            },
          }),
      }),
    );

    const result = expectFound(await fetchContributionData("testuser", "token"));
    expect(result.mergedPrTotalCount).toBe(0);
  });

  it("does not throw when pullRequestContributions is null (optional-chained, defaults to empty sample)", async () => {
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
                  pullRequestContributions: null,
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
              },
              search: { issueCount: 904 },
            },
          }),
      }),
    );

    const result = expectFound(await fetchContributionData("testuser", "token"));
    expect(result.pullRequests).toEqual({ totalCount: 0, nodes: [] });
    // The authoritative count still comes through — this is exactly the shape
    // assessRawFetchIntegrity (stats-integrity.ts) rejects downstream.
    expect(result.mergedPrTotalCount).toBe(904);
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

    const result = expectFound(await fetchContributionData("testuser", "token"));
    // Should have 2 nodes (the null one filtered out)
    expect(result.pullRequests.nodes).toHaveLength(2);
    expect(result.pullRequests.nodes[0]!.additions).toBe(10);
    expect(result.pullRequests.nodes[1]!.additions).toBe(5);
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
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^\[github\] fetch error for testuser — \w+: /),
    );
    consoleSpy.mockRestore();
  });

  it("maps ownedRepoStars nodes correctly, filtering nulls", async () => {
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
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                  pullRequestContributions: { totalCount: 0, nodes: [] },
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
                ownedRepos: {
                  nodes: [
                    { stargazerCount: 50, forkCount: 10, watchers: { totalCount: 5 } },
                    null,
                    { stargazerCount: 30, forkCount: 8, watchers: { totalCount: 3 } },
                  ],
                },
              },
            },
          }),
      }),
    );

    const result = expectFound(await fetchContributionData("testuser", "token"));
    expect(result.ownedRepoStars.nodes).toHaveLength(2);
    expect(result.ownedRepoStars.nodes[0]!.stargazerCount).toBe(50);
    expect(result.ownedRepoStars.nodes[1]!.stargazerCount).toBe(30);
  });

  it("handles missing ownedRepos gracefully", async () => {
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
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                  pullRequestContributions: { totalCount: 0, nodes: [] },
                  pullRequestReviewContributions: { totalCount: 0 },
                  issueContributions: { totalCount: 0 },
                },
                repositories: { totalCount: 0, nodes: [] },
              },
            },
          }),
      }),
    );

    const result = expectFound(await fetchContributionData("testuser", "token"));
    expect(result.ownedRepoStars.nodes).toEqual([]);
  });

  it("handles unreadable error body on HTTP failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("body read failed")),
      }),
    );

    const result = await fetchContributionData("testuser", "token");
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[github] GraphQL HTTP 500"),
    );
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // BE-M4 (#870): Log body truncation (≤200 chars) + control-char stripping
  // ---------------------------------------------------------------------------

  it("BE-M4: truncates long error bodies in log to ≤200 chars", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const longBody = "a".repeat(500);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve(longBody),
      }),
    );

    await fetchContributionData("testuser", "token");

    const logged = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("[github]"),
    );
    expect(logged).toBeDefined();
    const loggedStr = logged![0] as string;
    // The body snippet embedded in the log line must be ≤200 chars
    // Overall log line = prefix + status + snippet, but snippet ≤200
    expect(loggedStr.length).toBeLessThanOrEqual(350);
    consoleSpy.mockRestore();
  });

  it("BE-M4: strips control characters from the logged body snippet", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adversarialBody = "err\x00\x01\x1b[31mRED\x1b[0m\nmore";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve(adversarialBody),
      }),
    );

    await fetchContributionData("testuser", "token");

    const logged = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("[github]"),
    );
    expect(logged).toBeDefined();
    const loggedStr = logged![0] as string;
    expect(loggedStr).not.toMatch(/\x1b/);
    expect(loggedStr).not.toMatch(/\x00/);
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // BE-M3 (#880): Retry on transient 5xx for GitHub GraphQL (idempotent read)
  // ---------------------------------------------------------------------------

  it("BE-M3: retries a transient 5xx and succeeds on the second attempt", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve("Service Unavailable"),
          });
        }
        return Promise.resolve({
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
                    pullRequestContributions: { totalCount: 0, nodes: [] },
                    pullRequestReviewContributions: { totalCount: 0 },
                    issueContributions: { totalCount: 0 },
                  },
                  repositories: { totalCount: 0, nodes: [] },
                },
              },
            }),
        });
      }),
    );

    expectFound(await fetchContributionData("testuser", "token"));
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("BE-M3: persistent 5xx returns null after max attempts", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service Unavailable"),
      }),
    );

    const result = await fetchContributionData("testuser", "token");
    expect(result).toBeNull();
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
    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^\[github\] fetch error for testuser — \w+: /),
    );
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // BE-H12: RATE_LIMITED / FORBIDDEN partial error handling (#699)
  // ---------------------------------------------------------------------------

  describe("partial error handling for rate-limited / forbidden responses (#699)", () => {
    it("returns null when errors contain RATE_LIMITED type (extensions.type)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [
                {
                  message: "API rate limit exceeded",
                  extensions: { type: "RATE_LIMITED" },
                },
              ],
              // GitHub returns partial data alongside the error
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
        }),
      );

      const result = await fetchContributionData("testuser", "token");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
        "[github] GraphQL errors for testuser",
      );
      consoleSpy.mockRestore();
    });

    it("returns null when errors contain FORBIDDEN type (extensions.type)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [
                {
                  message: "Resource not accessible by integration",
                  extensions: { type: "FORBIDDEN" },
                },
              ],
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
        }),
      );

      const result = await fetchContributionData("testuser", "token");

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("returns null when errors contain RATE_LIMITED code (error.code)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [{ message: "rate limit exceeded", code: "RATE_LIMITED" }],
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
        }),
      );

      const result = await fetchContributionData("testuser", "token");

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("returns null when errors contain FORBIDDEN code (error.code)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [{ message: "forbidden", code: "FORBIDDEN" }],
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
        }),
      );

      const result = await fetchContributionData("testuser", "token");

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it("still returns data when errors are non-blocking (e.g. missing field)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [
                { message: "Could not resolve field 'extraField'", extensions: { type: "FIELD_NOT_FOUND" } },
              ],
              data: {
                user: {
                  login: "testuser",
                  name: "Test",
                  avatarUrl: "https://example.com/avatar.png",
                  contributionsCollection: {
                    contributionCalendar: { totalContributions: 5, weeks: [] },
                    pullRequestContributions: { totalCount: 2, nodes: [] },
                    pullRequestReviewContributions: { totalCount: 1 },
                    issueContributions: { totalCount: 0 },
                  },
                  repositories: { totalCount: 1, nodes: [] },
                },
              },
            }),
        }),
      );

      // Non-blocking error — should still return data
      const result = expectFound(await fetchContributionData("testuser", "token"));
      expect(result.login).toBe("testuser");
      consoleSpy.mockRestore();
    });
  });

  // LE-8-2 — the one answer that must not collapse into the same `null` as an
  // outage: GitHub responded, and the handle is nobody's.
  describe("a handle GitHub does not know (LE-8-2)", () => {
    function stubGraphql(body: unknown) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }),
      );
    }
    const nullUser = { user: null, search: { issueCount: 0 } };

    it("returns the not-found sentinel when data.user is null beside GitHub's NOT_FOUND error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubGraphql({
        data: nullUser,
        errors: [
          {
            type: "NOT_FOUND",
            path: ["user"],
            locations: [{ line: 2, column: 3 }],
            message: "Could not resolve to a User with the login of 'ghost'.",
          },
        ],
      });

      const result = await fetchContributionData("ghost", "token");

      expect(result).toEqual(githubUserNotFound("ghost"));
      consoleSpy.mockRestore();
    });

    it("returns the sentinel when data.user is null and there are no errors at all", async () => {
      stubGraphql({ data: nullUser });

      expect(isGitHubUserNotFound(await fetchContributionData("ghost", "token"))).toBe(true);
    });

    it("recognizes NOT_FOUND carried in extensions.type as well", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubGraphql({ data: nullUser, errors: [{ message: "no such user", extensions: { type: "NOT_FOUND" } }] });

      expect(isGitHubUserNotFound(await fetchContributionData("ghost", "token"))).toBe(true);
      consoleSpy.mockRestore();
    });

    it("still returns null when data.user is null beside an error that is not NOT_FOUND", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubGraphql({ data: nullUser, errors: [{ message: "Something went wrong while executing your query." }] });

      expect(await fetchContributionData("ghost", "token")).toBeNull();
      consoleSpy.mockRestore();
    });

    it("still returns null for RATE_LIMITED even when data.user is null", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubGraphql({ data: nullUser, errors: [{ message: "rate limited", extensions: { type: "RATE_LIMITED" } }] });

      expect(await fetchContributionData("ghost", "token")).toBeNull();
      consoleSpy.mockRestore();
    });

    it("still returns null when the payload carries no data object at all", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubGraphql({ errors: [{ type: "NOT_FOUND", message: "no such user" }] });

      expect(await fetchContributionData("ghost", "token")).toBeNull();
      consoleSpy.mockRestore();
    });

    it("still returns null, never the sentinel, when the token is rejected with HTTP 401", async () => {
      // A bad or expired session token is GitHub refusing to answer, not
      // GitHub saying the handle is nobody's. The badge route falls back to
      // its 200 try-later SVG on null; a 404 here would 404 a real user.
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve("Bad credentials") }),
      );

      expect(await fetchContributionData("ghost", "ghp_e2e_fixture")).toBeNull();
      consoleSpy.mockRestore();
    });

    it("still returns null when the user key is absent rather than null", async () => {
      stubGraphql({ data: {} });

      expect(await fetchContributionData("ghost", "token")).toBeNull();
    });
  });
});
