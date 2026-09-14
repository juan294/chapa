/** Synthetic public ancillary activity. Cache and provider replay share one raw dataset. */
import { buildStatsFromRaw, type RawContributionData } from "@chapa/shared";
import { DEMO_STATS } from "../../lib/render/demoData";

export function buildRedesignGitHubFixture(handle: string, referenceTime: string) {
  const reference = Date.parse(referenceTime);
  if (!Number.isFinite(reference)) throw new Error("Invalid fixture clock");
  const days = DEMO_STATS.heatmapData.map((day, index, all) => ({
    date: new Date(reference - (all.length - 1 - index) * 86400000).toISOString().slice(0, 10),
    contributionCount: day.count,
  }));
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => ({ contributionDays: days.slice(index * 7, index * 7 + 7) }));
  const raw: RawContributionData = {
    login: handle, name: handle, avatarUrl: "", mergedPrTotalCount: DEMO_STATS.prsMergedCount,
    contributionCalendar: { totalContributions: days.reduce((total, day) => total + day.contributionCount, 0), weeks },
    pullRequests: { totalCount: DEMO_STATS.prsMergedCount, nodes: Array.from({ length: DEMO_STATS.prsMergedCount }, (_, index) => ({
      additions: Math.floor(DEMO_STATS.linesAdded / DEMO_STATS.prsMergedCount) + (index === 0 ? DEMO_STATS.linesAdded % DEMO_STATS.prsMergedCount : 0),
      deletions: Math.floor(DEMO_STATS.linesDeleted / DEMO_STATS.prsMergedCount) + (index === 0 ? DEMO_STATS.linesDeleted % DEMO_STATS.prsMergedCount : 0),
      changedFiles: 4, merged: true, body: "Synthetic fixture change", headRefName: `fixture-${index}`, baseRefName: "main",
      createdAt: new Date(reference - 2 * 86400000).toISOString(), mergedAt: new Date(reference - 86400000).toISOString(), closingIssuesCount: 1,
    })) },
    reviews: { totalCount: DEMO_STATS.reviewsSubmittedCount }, issues: { totalCount: DEMO_STATS.issuesClosedCount },
    repositories: { totalCount: DEMO_STATS.reposContributed, nodes: Array.from({ length: DEMO_STATS.reposContributed }, (_, index) => ({ nameWithOwner: `${handle}/fixture-${index}`, defaultBranchRef: { target: { history: { totalCount: index + 1 } } } })) },
    ownedRepoStars: { nodes: [{ stargazerCount: DEMO_STATS.totalStars, forkCount: DEMO_STATS.totalForks, watchers: { totalCount: DEMO_STATS.totalWatchers } }] },
  };
  const response = { data: { user: {
    login: raw.login, name: raw.name, avatarUrl: raw.avatarUrl,
    contributionsCollection: { contributionCalendar: raw.contributionCalendar,
      pullRequestContributions: { totalCount: raw.pullRequests.totalCount, nodes: raw.pullRequests.nodes.map(({ closingIssuesCount, ...pullRequest }) => ({ pullRequest: { ...pullRequest, closingIssuesReferences: { totalCount: closingIssuesCount } } })) },
      pullRequestReviewContributions: raw.reviews, issueContributions: raw.issues },
    repositories: raw.repositories, ownedRepos: raw.ownedRepoStars,
  }, search: { issueCount: raw.mergedPrTotalCount } } };
  return { raw, response, stats: { ...buildStatsFromRaw(raw), fetchedAt: referenceTime } };
}
