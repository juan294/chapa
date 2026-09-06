import { describe, it, expect } from "vitest";
import type { RawContributionData } from "@chapa/shared";
import { assessRawFetchIntegrity, isValidLegacyStats } from "./stats-integrity";
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

describe("legacy structural integrity (not v7 coverage)", () => {
  it("accepts valid aggregates, including measured zero and annual expiration", () => {
    expect(isValidLegacyStats(makeStats())).toBe(true);
    expect(isValidLegacyStats(makeStats({ prsMergedCount: 0, prsMergedWeight: 0, linesAdded: 0, linesDeleted: 0 }))).toBe(true);
  });

  it.each([NaN, Infinity, -1, 0.5])("rejects malformed aggregate counts: %s", value => {
    expect(isValidLegacyStats(makeStats({ prsMergedCount: value }))).toBe(false);
  });

  it("rejects malformed aggregate dates and shares", () => {
    expect(isValidLegacyStats(makeStats({ fetchedAt: "invalid" }))).toBe(false);
    expect(isValidLegacyStats(makeStats({ topRepoShare: 1.1 }))).toBe(false);
    expect(isValidLegacyStats(makeStats({ prsMergedWeight: NaN }))).toBe(false);
  });

  // A malformed shape is rejected before the calendar arithmetic runs.
  it.each([123, null, "2026-9-1", "2026-09-01T00:00:00Z", ""])("rejects a heatmap date that is not a plain calendar day: %s", date => {
    expect(isValidLegacyStats(makeStats({ heatmapData: [{ date, count: 0 } as never] }))).toBe(false);
  });

  it.each([
    { microCommitRatio: 1.5 },
    { batchSizeScore: -0.1 },
    { docsOnlyPrRatio: NaN },
    { prDescriptionRate: Infinity },
  ])("rejects an optional ratio outside 0..1: %o", overrides => {
    expect(isValidLegacyStats(makeStats(overrides))).toBe(false);
  });

  it("accepts omitted optional ratios, lead time and primary review count", () => {
    expect(isValidLegacyStats(makeStats({
      microCommitRatio: undefined, batchSizeScore: undefined, docsOnlyPrRatio: undefined,
      prDescriptionRate: undefined, featureBranchRate: undefined, issueLinkageRate: undefined,
      medianPrLeadTimeHours: undefined, primaryReviewsSubmittedCount: undefined,
    }))).toBe(true);
  });

  it.each([-1, NaN, Infinity])("rejects a malformed median lead time: %s", medianPrLeadTimeHours => {
    expect(isValidLegacyStats(makeStats({ medianPrLeadTimeHours }))).toBe(false);
  });

  it.each([1.5, -1, NaN])("rejects a malformed primary review count: %s", primaryReviewsSubmittedCount => {
    expect(isValidLegacyStats(makeStats({ primaryReviewsSubmittedCount }))).toBe(false);
  });

  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01"])("rejects impossible calendar and heatmap dates: %s", date => {
    expect(isValidLegacyStats(makeStats({ heatmapData: [{ date, count: 0 }] }))).toBe(false);
    expect(assessRawFetchIntegrity(makeRaw({ contributionCalendar: { totalContributions: 0, weeks: [{ contributionDays: [{ date, contributionCount: 0 }] }] } })).ok).toBe(false);
  });

  it("accepts leap days and optional legacy timestamps", () => {
    expect(isValidLegacyStats(makeStats({ heatmapData: [{ date: "2024-02-29", count: 0 }] }))).toBe(true);
    const raw = makeRaw();
    expect(assessRawFetchIntegrity(raw).ok).toBe(true);
    raw.pullRequests.nodes[0]!.createdAt = "2024-02-29T23:30:00-02:00";
    raw.pullRequests.nodes[0]!.mergedAt = null;
    expect(assessRawFetchIntegrity(raw).ok).toBe(true);
    raw.pullRequests.nodes[0]!.mergedAt = "2026-02-30T12:00:00Z";
    expect(assessRawFetchIntegrity(raw).ok).toBe(false);
  });

  it("accepts structurally valid raw input", () => {
    expect(assessRawFetchIntegrity(makeRaw())).toEqual({ ok: true });
  });

  it("does not infer missing work from empty or capped PR samples", () => {
    expect(assessRawFetchIntegrity(makeRaw({ mergedPrTotalCount: 904, pullRequests: { totalCount: 143, nodes: [] } }))).toEqual({ ok: true });
    const node = makeRaw().pullRequests.nodes[0]!;
    expect(assessRawFetchIntegrity(makeRaw({ mergedPrTotalCount: 904, pullRequests: { totalCount: 143, nodes: Array.from({ length: 100 }, () => node) } }))).toEqual({ ok: true });
    expect(assessRawFetchIntegrity(makeRaw({ mergedPrTotalCount: 0, pullRequests: { totalCount: 50, nodes: [] } }))).toEqual({ ok: true });
  });

  it("rejects missing blocks without fabricating zeros", () => {
    expect(assessRawFetchIntegrity({ ...makeRaw(), issues: undefined } as unknown as RawContributionData)).toEqual({ ok: false, reason: "missing_required_block" });
  });

  it.each([NaN, Infinity, -1, 0.5, "0"])("rejects malformed raw counts: %s", value => {
    expect(assessRawFetchIntegrity({ ...makeRaw(), mergedPrTotalCount: value } as unknown as RawContributionData)).toEqual({ ok: false, reason: "invalid_legacy_schema" });
  });

  it("rejects malformed nested collections and rows", () => {
    for (const nodes of [null, {}, [null], [{ ...makeRaw().pullRequests.nodes[0], additions: NaN }]]) {
      expect(assessRawFetchIntegrity({ ...makeRaw(), pullRequests: { totalCount: 1, nodes } } as unknown as RawContributionData).ok).toBe(false);
    }
    expect(assessRawFetchIntegrity(makeRaw({ repositories: { totalCount: 1, nodes: [{ nameWithOwner: "a/b", defaultBranchRef: { target: { history: { totalCount: -1 } } } }] } })).ok).toBe(false);
    expect(assessRawFetchIntegrity(makeRaw({ ownedRepoStars: { nodes: [{ stargazerCount: NaN, forkCount: 0, watchers: { totalCount: 0 } }] } })).ok).toBe(false);
  });
});
