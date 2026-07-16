import { describe, it, expect } from "vitest";
import type { RawContributionData } from "@chapa/shared";
import { isDegradedPrFetch, assessRawFetchIntegrity, isPoisonedStats } from "./stats-integrity";
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

  // ---- #1045: a search-derived count no longer collapses to exactly zero ----
  // #1004 sourced prsMergedCount from `search(is:merged)`, which — contrary to
  // the comment it shipped with — IS token-scoped. A public fetch therefore
  // returns a plausible-but-wrong *positive* count (juan294: 140 public vs 987
  // authenticated) instead of 0, so the `prsMergedCount === 0` trigger below
  // became unreachable and #1004 silently disarmed #1002's tripwire.

  it("flags the juan294 #1045 signature: public fetch shows a fraction of an authenticated baseline", () => {
    // Production, 2026-07-14. Ground truth from GitHub's API:
    //   authenticated search → 987 merged PRs
    //   anonymous search     → 140 merged PRs
    // The public fetch's 140 is real data, just scope-blinded. Delivery fell
    // 100 → 58 because prsMergedWeight (70% of Delivery) collapsed 120 → 3.38.
    const fresh = makeStats({
      fetchScope: "public",
      prsMergedCount: 140,
      prsMergedWeight: 3.37828,
      linesAdded: 59,
      linesDeleted: 10,
      commitsTotal: 16292,
      issuesClosedCount: 5208,
    });
    const lastGood = makeStats({
      fetchScope: "authenticated",
      prsMergedCount: 953,
      prsMergedWeight: 120,
      linesAdded: 101313,
      linesDeleted: 54996,
      commitsTotal: 16187,
      issuesClosedCount: 608,
    });

    expect(isDegradedPrFetch(fresh, lastGood)).toBe(true);
  });

  it("does NOT flag a severe drop when the fresh fetch is equally-scoped (a real decline)", () => {
    // Same scope on both sides → the drop is real window eviction, not scope
    // loss. Blocking here would freeze a legitimately-declining profile behind
    // a stale value forever, since the guard also suppresses the stale write.
    const fresh = makeStats({ fetchScope: "authenticated", prsMergedCount: 40, commitsTotal: 900 });
    const lastGood = makeStats({ fetchScope: "authenticated", prsMergedCount: 953 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("does NOT flag a public fetch that broadly agrees with the baseline", () => {
    // A public fetch of a public-only profile sees essentially everything.
    // Only a *disproportionate* shortfall indicates lost visibility.
    const fresh = makeStats({ fetchScope: "public", prsMergedCount: 900, commitsTotal: 16000 });
    const lastGood = makeStats({ fetchScope: "authenticated", prsMergedCount: 953 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("still allows a public fetch to heal a poisoned baseline (blocks good→bad only)", () => {
    const fresh = makeStats({ fetchScope: "public", prsMergedCount: 140, commitsTotal: 16292 });
    const poisonedBaseline = makeStats({ fetchScope: "public", prsMergedCount: 2, commitsTotal: 16000 });
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

describe("assessRawFetchIntegrity — #1045 disproportionate sample", () => {
  // The sample is fetched as `pullRequestContributions(first: 100)`
  // (packages/shared/src/github-query.ts:33), so a payload whose own
  // totalCount says N must carry min(N, 100) nodes. Fewer means the payload
  // is internally broken — a check that needs no baseline and no knowledge of
  // token scope, which is why it catches the very first degraded fetch.

  function prNode(merged: boolean, additions = 10) {
    return {
      additions,
      deletions: 2,
      changedFiles: 1,
      merged,
      body: null,
      headRefName: "feat/x",
      closingIssuesCount: 0,
    };
  }

  it("rejects a near-empty sample when the payload's own totalCount is high", () => {
    // The 07-14 juan294 shape: 140 merged per search, but the sample carried
    // ~2 tiny nodes (prsMergedWeight 3.38, linesAdded 59 across 140 PRs —
    // ~0.4 lines/PR, which is not physically possible).
    const raw = makeRaw({
      mergedPrTotalCount: 140,
      pullRequests: { totalCount: 143, nodes: [prNode(true, 40), prNode(true, 19)] },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({
      ok: false,
      reason: "pr_sample_disproportionate_to_total",
    });
  });

  it("accepts a sample truncated at exactly the 100-node cap", () => {
    // totalCount far above the cap is normal: GraphQL returns the first 100.
    const raw = makeRaw({
      mergedPrTotalCount: 900,
      pullRequests: { totalCount: 953, nodes: Array.from({ length: 100 }, () => prNode(true)) },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });

  it("accepts a small account whose sample is complete", () => {
    const raw = makeRaw({
      mergedPrTotalCount: 3,
      pullRequests: { totalCount: 3, nodes: [prNode(true), prNode(true), prNode(false)] },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });

  it("accepts a sample of mostly-unmerged PRs (merged nodes may legitimately be few)", () => {
    // The sample is capped on PR *contributions*, not merged ones. A user with
    // many open PRs can have few merged nodes without any degradation, so the
    // check must key on node count vs totalCount, never on merged-node count
    // vs the search total.
    const raw = makeRaw({
      mergedPrTotalCount: 4,
      pullRequests: { totalCount: 60, nodes: Array.from({ length: 60 }, (_, i) => prNode(i < 4)) },
    });
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });
});

describe("isPoisonedStats", () => {
  it("flags the poisoned shape: zero merged PRs despite real commit activity", () => {
    expect(
      isPoisonedStats({ prsMergedCount: 0, commitsTotal: 15533, issuesClosedCount: 0 }),
    ).toBe(true);
  });

  it("flags the poisoned shape: zero merged PRs despite real closed-issue activity", () => {
    expect(
      isPoisonedStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 42 }),
    ).toBe(true);
  });

  it("does not flag a genuinely empty account (all zero)", () => {
    expect(
      isPoisonedStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 0 }),
    ).toBe(false);
  });

  it("does not flag a healthy profile with merged PRs", () => {
    expect(
      isPoisonedStats({ prsMergedCount: 41, commitsTotal: 14000, issuesClosedCount: 608 }),
    ).toBe(false);
  });
});
