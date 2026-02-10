import type { Stats90d, HeatmapDay } from "@chapa/shared";
import { CONTRIBUTION_QUERY, computePrWeight } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Fetch EMU stats via GraphQL (requires EMU token with auth)
// ---------------------------------------------------------------------------

export async function fetchEmuStats(
  login: string,
  emuToken: string,
): Promise<Stats90d | null> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 90);

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${emuToken}`,
      },
      body: JSON.stringify({
        query: CONTRIBUTION_QUERY,
        variables: {
          login,
          since: since.toISOString(),
          until: now.toISOString(),
          historySince: since.toISOString(),
          historyUntil: now.toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`[cli] GraphQL HTTP ${res.status}: ${body}`);
      return null;
    }

    const json = await res.json();
    if (!json.data?.user) return null;

    const user = json.data.user;
    const cc = user.contributionsCollection;

    // Heatmap
    const heatmapData: HeatmapDay[] = [];
    for (const week of cc.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        heatmapData.push({ date: day.date, count: day.contributionCount });
      }
    }

    const activeDays = heatmapData.filter((d) => d.count > 0).length;

    // PRs
    const prNodes = cc.pullRequestContributions.nodes
      .filter(
        (n: { pullRequest: unknown } | null) =>
          n != null && n.pullRequest != null,
      )
      .map(
        (n: {
          pullRequest: {
            additions: number;
            deletions: number;
            changedFiles: number;
            merged: boolean;
          };
        }) => n.pullRequest,
      );
    const mergedPRs = prNodes.filter(
      (pr: { merged: boolean }) => pr.merged,
    );
    const prsMergedCount = mergedPRs.length;
    const prsMergedWeight = Math.min(
      mergedPRs.reduce(
        (sum: number, pr: { additions: number; deletions: number; changedFiles: number }) =>
          sum + computePrWeight(pr),
        0,
      ),
      40,
    );

    const linesAdded = mergedPRs.reduce(
      (sum: number, pr: { additions: number }) => sum + pr.additions,
      0,
    );
    const linesDeleted = mergedPRs.reduce(
      (sum: number, pr: { deletions: number }) => sum + pr.deletions,
      0,
    );

    // Repos
    const repoCommits = user.repositories.nodes
      .map((r: { nameWithOwner: string; defaultBranchRef: { target: { history: { totalCount: number } } } | null }) => ({
        name: r.nameWithOwner,
        commits: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
      }))
      .filter((r: { commits: number }) => r.commits > 0);
    const reposContributed = repoCommits.length;
    const totalRepoCommits = repoCommits.reduce(
      (s: number, r: { commits: number }) => s + r.commits,
      0,
    );
    const topRepoShare =
      totalRepoCommits > 0
        ? Math.max(
            ...repoCommits.map((r: { commits: number }) => r.commits),
          ) / totalRepoCommits
        : 0;

    // Max daily spike approximation
    const maxDailyCount = Math.max(
      ...heatmapData.map((d) => d.count),
      0,
    );
    const maxCommitsIn10Min = maxDailyCount >= 30 ? maxDailyCount : 0;

    return {
      handle: user.login,
      displayName: user.name ?? undefined,
      avatarUrl: user.avatarUrl,
      commitsTotal: cc.contributionCalendar.totalContributions,
      activeDays,
      prsMergedCount,
      prsMergedWeight,
      reviewsSubmittedCount: cc.pullRequestReviewContributions.totalCount,
      issuesClosedCount: cc.issueContributions.totalCount,
      linesAdded,
      linesDeleted,
      reposContributed,
      topRepoShare,
      maxCommitsIn10Min,
      heatmapData,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[cli] fetch error:`, err);
    return null;
  }
}
