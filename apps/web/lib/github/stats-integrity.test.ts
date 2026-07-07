import { describe, it, expect } from "vitest";
import type { RawContributionData } from "@chapa/shared";
import { isDegradedPrFetch, assessRawFetchIntegrity } from "./stats-integrity";
import { makeStats } from "../test-helpers/fixtures";

function makeRaw(overrides: Partial<RawContributionData> = {}): RawContributionData {
  return {
    login: "test-user",
    name: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    mergedPrTotalCount: 2,
    contributionCalendar: { totalContributions: 100, weeks: [] },
    pullRequests: {
      totalCount: 2,
      nodes: [
        { additions: 10, deletions: 2, changedFiles: 1, merged: true, body: null, headRefName: "feat/a", closingIssuesCount: 0 },
        { additions: 20, deletions: 5, changedFiles: 2, merged: true, body: null, headRefName: "feat/b", closingIssuesCount: 0 },
      ],
    },
    reviews: { totalCount: 5 },
    issues: { totalCount: 1 },
    repositories: { totalCount: 0, nodes: [] },
    ownedRepoStars: { nodes: [] },
    ...overrides,
  };
}

describe("isDegradedPrFetch", () => {
  it("flags a zero-PR fetch when last-known-good had merged PRs and activity remains", () => {
    // The confirmed #1002 signature: viewer-scoped fetch loses private-repo
    // PR visibility → prsMergedCount 0, but commits/issues stay high.
    const fresh = makeStats({
      prsMergedCount: 0,
      prsMergedWeight: 0,
      commitsTotal: 15533,
      issuesClosedCount: 5096,
    });
    const lastGood = makeStats({
      prsMergedCount: 41,
      prsMergedWeight: 120,
      commitsTotal: 14000,
      issuesClosedCount: 608,
    });

    expect(isDegradedPrFetch(fresh, lastGood)).toBe(true);
  });

  it("flags a zero-PR fetch when only issues remain (no commits)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 42 });
    const lastGood = makeStats({ prsMergedCount: 10 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(true);
  });

  it("accepts a fetch that still has merged PRs (not a collapse)", () => {
    const fresh = makeStats({ prsMergedCount: 3, prsMergedWeight: 8 });
    const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("accepts a zero-PR fetch when there is no baseline (first-ever fetch)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 100 });
    expect(isDegradedPrFetch(fresh, null)).toBe(false);
    expect(isDegradedPrFetch(fresh, undefined)).toBe(false);
  });

  it("accepts a legitimate no-PR reviewer (baseline also had zero PRs)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 200, issuesClosedCount: 30 });
    const lastGood = makeStats({ prsMergedCount: 0, commitsTotal: 180 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("accepts a fully-empty fetch (indistinguishable from a reset account)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 0 });
    const lastGood = makeStats({ prsMergedCount: 10, commitsTotal: 500 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("allows the recovery path: zero baseline → real PRs writes through", () => {
    // When last-known-good was itself poisoned (prsMergedCount 0), a later
    // healthy fetch with real PRs must NOT be blocked, so the profile heals.
    const fresh = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
    const poisonedBaseline = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 15000 });
    expect(isDegradedPrFetch(fresh, poisonedBaseline)).toBe(false);
  });
});

describe("assessRawFetchIntegrity", () => {
  it("rejects the juan294 signature: search sees PRs, sample nodes empty", () => {
    const raw = makeRaw({
      mergedPrTotalCount: 904,
      pullRequests: { totalCount: 143, nodes: [] },
    });
    const result = assessRawFetchIntegrity(raw);
    expect(result).toEqual({ ok: false, reason: "pr_nodes_empty_but_search_positive" });
  });

  it("rejects an internal inconsistency: totalCount positive but nodes empty (search also 0)", () => {
    const raw = makeRaw({
      mergedPrTotalCount: 0,
      pullRequests: { totalCount: 50, nodes: [] },
    });
    const result = assessRawFetchIntegrity(raw);
    expect(result).toEqual({ ok: false, reason: "pr_totalcount_positive_but_nodes_empty" });
  });

  it("accepts a genuinely empty account (search 0, sample empty)", () => {
    const raw = makeRaw({
      mergedPrTotalCount: 0,
      pullRequests: { totalCount: 0, nodes: [] },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });

  it("accepts a healthy fetch where the sample is a non-empty subset of the authoritative count", () => {
    const raw = makeRaw({
      mergedPrTotalCount: 904,
      pullRequests: {
        totalCount: 143,
        nodes: Array.from({ length: 96 }, (_, i) => ({
          additions: 10, deletions: 2, changedFiles: 1, merged: true,
          body: null, headRefName: `feat/${i}`, closingIssuesCount: 0,
        })),
      },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });

  it("rejects a missing required block", () => {
    const raw = makeRaw();
    // @ts-expect-error — simulating a malformed payload at runtime
    raw.pullRequests = undefined;
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: false, reason: "missing_required_block" });
  });
});
