import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bucketEventsByDate,
  parseDiffStat,
  fetchGitlabContributionData,
} from "./queries";
import type { GitlabEvent } from "./types";
import { _setRetryDelayFn } from "@/lib/utils/fetch-retry";

// ---------------------------------------------------------------------------
// bucketEventsByDate (pure)
// ---------------------------------------------------------------------------

describe("bucketEventsByDate", () => {
  it("counts push events by their commit_count", () => {
    const events: GitlabEvent[] = [
      { created_at: "2026-06-10T09:00:00Z", action_name: "pushed to", push_data: { commit_count: 3 } },
      { created_at: "2026-06-10T15:00:00Z", action_name: "pushed to", push_data: { commit_count: 2 } },
    ];
    expect(bucketEventsByDate(events)).toEqual([{ date: "2026-06-10", count: 5 }]);
  });

  it("counts non-push contribution events as 1 each", () => {
    const events: GitlabEvent[] = [
      { created_at: "2026-06-11T09:00:00Z", action_name: "opened" },
      { created_at: "2026-06-11T10:00:00Z", action_name: "commented on" },
    ];
    expect(bucketEventsByDate(events)).toEqual([{ date: "2026-06-11", count: 2 }]);
  });

  it("groups multiple days and sorts ascending", () => {
    const events: GitlabEvent[] = [
      { created_at: "2026-06-12T09:00:00Z", action_name: "opened" },
      { created_at: "2026-06-10T09:00:00Z", push_data: { commit_count: 4 } },
    ];
    expect(bucketEventsByDate(events)).toEqual([
      { date: "2026-06-10", count: 4 },
      { date: "2026-06-12", count: 1 },
    ]);
  });

  it("returns empty array for no events", () => {
    expect(bucketEventsByDate([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseDiffStat (pure)
// ---------------------------------------------------------------------------

describe("parseDiffStat", () => {
  it("counts added and removed lines, ignoring +++/--- file headers", () => {
    const diff =
      "--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,3 @@\n-old line\n+new line 1\n+new line 2\n context";
    const stat = parseDiffStat([{ diff }]);
    expect(stat.additions).toBe(2);
    expect(stat.deletions).toBe(1);
    expect(stat.changed_files).toBe(1);
  });

  it("sums across multiple changed files", () => {
    const stat = parseDiffStat([
      { diff: "+a\n+b" },
      { diff: "-c" },
    ]);
    expect(stat.additions).toBe(2);
    expect(stat.deletions).toBe(1);
    expect(stat.changed_files).toBe(2);
  });

  it("returns zeros for an empty change set", () => {
    expect(parseDiffStat([])).toEqual({ additions: 0, deletions: 0, changed_files: 0 });
  });
});

// ---------------------------------------------------------------------------
// fetchGitlabContributionData (integration, mocked fetch)
// ---------------------------------------------------------------------------

const PROFILE = { displayName: "GL User", avatarUrl: "https://gitlab.com/a/1" };

/** Route a fetch mock by URL substring. */
function routeFetch(routes: { match: string; status?: number; body: unknown }[]) {
  return vi.fn((url: string) => {
    const route = routes.find((r) => url.includes(r.match));
    if (!route) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }
    const status = route.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(route.body),
    });
  });
}

describe("fetchGitlabContributionData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Skip retry delays so tests don't hang
    _setRetryDelayFn(() => Promise.resolve());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the events endpoint returns 401 (auth failure)", async () => {
    vi.stubGlobal("fetch", routeFetch([{ match: "/events", status: 401, body: {} }]));

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  it("aggregates events, MRs, diffstats, reviews, issues and projects", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: "/users/42/events",
          body: [
            { created_at: "2026-06-10T09:00:00Z", push_data: { commit_count: 3 } },
            { created_at: "2026-06-11T09:00:00Z", action_name: "opened" },
          ],
        },
        // merged MRs authored by user
        {
          match: "merge_requests?author_username=gluser",
          body: [{ id: 1, iid: 7, project_id: 100, state: "merged", merged_at: "x", author: { username: "gluser" } }],
        },
        // per-MR diffstat
        {
          match: "/merge_requests/7/changes",
          body: { changes: [{ diff: "+a\n+b\n-c" }] },
        },
        // reviewed MRs (by reviewer) authored by someone else
        {
          match: "merge_requests?reviewer_username=gluser",
          body: [{ id: 2, iid: 9, project_id: 200, state: "merged", merged_at: "x", author: { username: "other" } }],
        },
        // approvals — user approved
        {
          match: "/merge_requests/9/approvals",
          body: { approved_by: [{ user: { username: "gluser" } }] },
        },
        // closed issues
        {
          match: "/issues",
          body: [{ id: 1 }, { id: 2 }],
        },
        // user projects
        {
          match: "/users/42/projects",
          body: [
            { id: 100, path_with_namespace: "gluser/repo", star_count: 12, forks_count: 4, namespace: { path: "gluser" } },
          ],
        },
      ]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).not.toBeNull();
    expect(result!.heatmap).toEqual([
      { date: "2026-06-10", count: 3 },
      { date: "2026-06-11", count: 1 },
    ]);
    expect(result!.mergedPRs).toEqual([{ additions: 2, deletions: 1, changed_files: 1 }]);
    expect(result!.reviewsCount).toBe(1);
    expect(result!.closedIssues).toBe(2);
    expect(result!.repos).toHaveLength(1);
    expect(result!.repos[0]).toMatchObject({
      fullName: "gluser/repo",
      commitCount: 1,
      isOwned: true,
      starsCount: 12,
      forksCount: 4,
      watchersCount: 0,
    });
  });

  it("contributes a zero diffstat when an MR's changes fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        { match: "/users/42/events", body: [] },
        {
          match: "merge_requests?author_username=gluser",
          body: [{ id: 1, iid: 7, project_id: 100, state: "merged", merged_at: "x", author: { username: "gluser" } }],
        },
        { match: "/merge_requests/7/changes", status: 500, body: {} },
        { match: "reviewer_username=gluser", body: [] },
        { match: "/issues", body: [] },
        { match: "/users/42/projects", body: [] },
      ]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result!.mergedPRs).toEqual([{ additions: 0, deletions: 0, changed_files: 0 }]);
  });

  it("counts 0 reviews when the approvals endpoint is Premium-gated (403)", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        { match: "/users/42/events", body: [] },
        { match: "author_username=gluser", body: [] },
        {
          match: "merge_requests?reviewer_username=gluser",
          body: [{ id: 2, iid: 9, project_id: 200, state: "merged", merged_at: "x", author: { username: "other" } }],
        },
        { match: "/merge_requests/9/approvals", status: 403, body: {} },
        { match: "/issues", body: [] },
        { match: "/users/42/projects", body: [] },
      ]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result!.reviewsCount).toBe(0);
  });

  it("returns null when the events endpoint returns 403 (auth failure)", async () => {
    vi.stubGlobal("fetch", routeFetch([{ match: "/events", status: 403, body: {} }]));

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  it("stops events pagination at a short page (does not request the next page)", async () => {
    const fullPage = Array.from({ length: 100 }, () => ({
      created_at: "2026-06-10T09:00:00Z",
      action_name: "opened",
    }));
    let eventsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        eventsCalls++;
        const page = new URL(url).searchParams.get("page");
        // page 1 is full (100) → keep going; page 2 is short (2) → stop.
        const body = page === "1" ? fullPage : fullPage.slice(0, 2);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(eventsCalls).toBe(2); // page 1 (full) + page 2 (short) → stops, no page 3
  });

  it("caps events pagination at MAX_PAGES when every page is full", async () => {
    const fullPage = Array.from({ length: 100 }, () => ({
      created_at: "2026-06-10T09:00:00Z",
      action_name: "opened",
    }));
    let eventsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        eventsCalls++;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(fullPage) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(eventsCalls).toBe(5); // MAX_PAGES hard cap — never unbounded
  });

  // ---------------------------------------------------------------------------
  // BE-H1 (#859): fetchPaginated — 429/5xx mid-pagination returns null
  // ---------------------------------------------------------------------------

  it("BE-H1: returns null when fetchPaginated encounters a 429 on page 1", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: "/events", status: 429, body: {} }]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  it("BE-H1: returns null when fetchPaginated encounters a 500 on page 2", async () => {
    const fullPage = Array.from({ length: 100 }, () => ({
      created_at: "2026-06-10T09:00:00Z",
      action_name: "opened",
    }));
    let eventsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        eventsCalls++;
        const status = eventsCalls === 1 ? 200 : 500;
        const body = eventsCalls === 1 ? fullPage : {};
        return Promise.resolve({
          ok: status < 400,
          status,
          json: () => Promise.resolve(body),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  it("BE-H1: 200 with data still returns items (success path unchanged)", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        { match: "/users/42/events", body: [{ created_at: "2026-06-10T09:00:00Z", action_name: "opened" }] },
        { match: "merge_requests?author_username=gluser", body: [] },
        { match: "reviewer_username=gluser", body: [] },
        { match: "/issues", body: [] },
        { match: "/users/42/projects", body: [] },
      ]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).not.toBeNull();
    expect(result!.heatmap).toHaveLength(1);
  });

  it("BE-H1: 401/403 from fetchPaginated returns null (unchanged behaviour)", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: "/events", status: 403, body: {} }]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // BE-M3 (#880): Jittered retry on transient 5xx
  // ---------------------------------------------------------------------------

  it("BE-M3: retries a transient 5xx and succeeds on the second attempt", async () => {
    let eventsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        eventsCalls++;
        // First call: 503. Second call: 200 with data.
        if (eventsCalls === 1) {
          return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([{ created_at: "2026-06-10T09:00:00Z", action_name: "opened" }]),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).not.toBeNull();
    // At least 2 calls to /events (initial + retry)
    expect(eventsCalls).toBeGreaterThanOrEqual(2);
  });

  it("BE-M3: persistent 5xx returns null after max attempts", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: "/events", status: 503, body: {} }]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // BE-M4 (#870): Log body truncation and control-char stripping
  // ---------------------------------------------------------------------------

  it("BE-M4: logs only status + truncated snippet (≤200 chars) on HTTP errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const longBody = "x".repeat(500);
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(longBody),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);

    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("[gitlab]"),
    );
    expect(logged).toBeDefined();
    // The logged snippet must be ≤200 chars for the body portion
    const loggedStr = logged![0] as string;
    expect(loggedStr.length).toBeLessThanOrEqual(350); // status prefix + ≤200 snippet
    consoleSpy.mockRestore();
  });

  it("BE-M4: strips control characters from logged body", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adversarialBody = "error\x00\x01\x1b[31mred\x1b[0m\ntext";
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/events")) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(adversarialBody),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);

    const logged = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("[gitlab]"),
    );
    expect(logged).toBeDefined();
    const loggedStr = logged![0] as string;
    // Must not contain ANSI escape sequences or null bytes
    expect(loggedStr).not.toMatch(/\x1b/);
    expect(loggedStr).not.toMatch(/\x00/);
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // BE-M5 (#881): Shape guards at deserialization boundary
  // ---------------------------------------------------------------------------

  it("BE-M5: malformed events response (not an array) returns null without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: "/events", body: { not: "an array" } }]),
    );

    // Should not throw — should return null gracefully
    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  it("BE-M5: malformed MR list (not an array) returns null without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        { match: "/users/42/events", body: [] },
        { match: "merge_requests?author_username=gluser", body: "bad" },
        { match: "reviewer_username=gluser", body: [] },
        { match: "/issues", body: [] },
        { match: "/users/42/projects", body: [] },
      ]),
    );

    const result = await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // BE-L1 (#886): fetchReviewsCount caps per-MR approver lookups
  // ---------------------------------------------------------------------------

  it("BE-L1: caps approver lookups and does not make unbounded per-MR API calls", async () => {
    // Create 20 MRs authored by "other" — all eligible for approver lookup
    const manyMRs = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      iid: i + 1,
      project_id: 200 + i,
      state: "merged",
      merged_at: "x",
      author: { username: "other" },
    }));

    let approverCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/users/42/events")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url.includes("merge_requests?author_username=gluser")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url.includes("merge_requests?reviewer_username=gluser")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manyMRs) });
      }
      if (url.includes("/approvals")) {
        approverCalls++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ approved_by: [] }),
        });
      }
      if (url.includes("/issues")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url.includes("/users/42/projects")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitlabContributionData(42, "gluser", "tok", PROFILE);
    // Must be strictly less than the total number of eligible MRs (20)
    expect(approverCalls).toBeLessThan(20);
  });
});
