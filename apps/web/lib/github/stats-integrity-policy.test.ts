import { describe, expect, it } from "vitest";
import type { RawContributionData } from "@chapa/shared";
import { makeStats } from "../test-helpers/fixtures";
import { assessRawFetchIntegrity, isValidLegacyStats } from "./stats-integrity";

/** S08 policy regressions: activity magnitude cannot establish source corruption. */
describe("source integrity without productivity assumptions", () => {
  it.each([
    { prsMergedCount: 0, commitsTotal: 100, issuesClosedCount: 0 },
    { prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 100 },
    { prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 0 },
  ])("accepts a legitimate measured-zero PR profile: %o", stats => {
    expect(isValidLegacyStats(makeStats(stats))).toBe(true);
  });

  it("does not infer corruption when the last annual PR expires", () => {
    const previous = makeStats({ prsMergedCount: 1, commitsTotal: 100, fetchScope: "authenticated" });
    const current = makeStats({ prsMergedCount: 0, commitsTotal: 100, fetchScope: "authenticated" });
    expect(isValidLegacyStats(previous)).toBe(true);
    expect(isValidLegacyStats(current)).toBe(true);
  });

  it("does not treat legacy scope labels and activity ratios as corruption proof", () => {
    const previous = makeStats({ prsMergedCount: 100, commitsTotal: 100, fetchScope: "authenticated" });
    const current = makeStats({ prsMergedCount: 1, commitsTotal: 100, fetchScope: "public" });
    expect(isValidLegacyStats(previous)).toBe(true);
    expect(isValidLegacyStats(current)).toBe(true);
  });

  it("cannot infer lost nodes from low changed-line totals or PR weight", () => {
    expect(isValidLegacyStats(makeStats({ prsMergedCount: 100, prsMergedWeight: 0, linesAdded: 0, linesDeleted: 0 }))).toBe(true);
  });

  it("does not require a mixed-state sample to contain a merge found elsewhere", () => {
    const raw: RawContributionData = {
      login: "test-user", name: "Test User", avatarUrl: "https://example.test/avatar",
      mergedPrTotalCount: 1,
      contributionCalendar: { totalContributions: 101, weeks: [] },
      pullRequests: {
        totalCount: 101,
        nodes: Array.from({ length: 100 }, () => ({ additions: 10, deletions: 0, changedFiles: 1,
          merged: false, body: null, headRefName: "feature", closingIssuesCount: 0 })),
      },
      reviews: { totalCount: 0 }, issues: { totalCount: 0 },
      repositories: { totalCount: 0, nodes: [] }, ownedRepoStars: { nodes: [] },
    };
    expect(assessRawFetchIntegrity(raw)).toEqual({ ok: true });
  });
});
