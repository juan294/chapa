import { describe, expect, it, vi } from "vitest";
import { CONTRIBUTION_QUERY, REPOSITORY_STATS_QUERY, buildStatsFromRaw } from "@chapa/shared";
import { fetchContributionData } from "../../lib/github/queries";
import { buildRedesignGitHubFixture } from "./redesign-github";
import { createRedesignFetch } from "./redesign-upstream.mjs";
import { assessRawFetchIntegrity } from "../../lib/github/stats-integrity";

describe("synthetic ancillary GitHub replay", () => {
  it.each(["chapa-score-chromium", "chapa-score-mobile", "chapa-score-expired", "chapa-score-boundary"])("retains the same91 activity days and aggregate stats after a cache miss for%s", async handle => {
    const fixture = buildRedesignGitHubFixture(handle, "2026-09-08T12:00:00.000Z");
    const replay = createRedesignFetch({ cache: {}, github: { [handle]: fixture.response }, contributionQuery: CONTRIBUTION_QUERY, repositoryQuery: REPOSITORY_STATS_QUERY });
    const response = await replay("https://api.github.com/graphql", { method: "POST", body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: handle } }) });
    const body = await response.json();
    vi.stubGlobal("fetch", replay);
    try {
      const parsed = await fetchContributionData(handle, undefined, { resolvedCredential: { token: "redesign-local-fixture" }, referenceTime: "2026-09-08T12:00:00.000Z" });
      expect(parsed).toEqual(fixture.raw);
    } finally { vi.unstubAllGlobals(); }
    expect(body.data.user.login).toBe(handle);
    expect(body.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week: { contributionDays: unknown[] }) => week.contributionDays)).toHaveLength(91);
    expect(assessRawFetchIntegrity(fixture.raw)).toEqual({ ok: true });
    expect(fixture.stats).toEqual({ ...buildStatsFromRaw(fixture.raw), fetchedAt: "2026-09-08T12:00:00.000Z" });
    expect(fixture.stats.heatmapData).toHaveLength(91);
    expect(fixture.stats.activeDays).toBeGreaterThan(0);
  });
});
