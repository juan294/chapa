/**
 * Cross-platform aggregation parity test (AR-S1 / #949, extended by #1024)
 *
 * Asserts that the invariant aggregation steps (active days, repos contributed,
 * top-repo share, maxCommitsIn10Min) plus the PR-weight metrics (prsMergedWeight,
 * linesAdded, linesDeleted, prsMergedCount) produce identical results across all
 * four platform aggregators when given equivalent normalized inputs.
 *
 * Why this matters: AR-M1 extracted the invariant skeleton into
 * computePlatformStats() in packages/shared; #983 extended it to own the PR
 * aggregation loop (weight + aggregate cap + line sums) previously duplicated in
 * each per-platform file. This test is the regression guard — if the skeleton
 * ever drifts back toward per-platform divergence, these assertions will catch
 * it before it reaches scoring.
 *
 * GitHub (#1024): GitHub's `buildStatsFromRaw` (packages/shared/src/stats-aggregation.ts)
 * intentionally does NOT route through `computePlatformStats()` — it legitimately
 * diverges in two ways that must be preserved: `prsMergedCount` is sourced from the
 * authoritative `search(is:merged)` count (`raw.mergedPrTotalCount`), not
 * `mergedPrs.length`, and it computes GitHub-only quality signals
 * (`batchSizeScore`, `prDescriptionRate`, etc.) that the shared skeleton doesn't
 * have. Because of that, GitHub maintains its OWN inline copy of the invariant
 * steps (active days, repo-depth, topRepoShare, maxCommitsIn10Min) instead of
 * delegating to `computePlatformStats()`. This test proves those independently
 * computed OUTPUTS still match what the shared skeleton produces for
 * equivalent input — the `>= 30` burst-detection literal in both files is now
 * sourced from one shared constant (`DAILY_COMMIT_SPIKE_THRESHOLD`), and this
 * test is the regression guard that would catch either file drifting from the
 * other even though they run different code paths.
 *
 * Design:
 *   - Builds minimal "equivalent" fixtures for Bitbucket, GitLab, Codeberg, and
 *     GitHub that represent the same logical developer activity. The GitHub
 *     fixture uses GitHub's own raw GraphQL-shaped input (`RawContributionData`)
 *     rather than the `NormalizedRepo`/`NormalizedMergedPr` shape the other
 *     three share, since GitHub's raw shape is structurally different — but
 *     it is constructed with equivalent values so the invariant outputs must
 *     mathematically match.
 *   - Asserts that all invariant + PR-weight output fields are identical.
 *   - Genuinely platform-specific fields (totalStars, totalForks, totalWatchers,
 *     handle, displayName, reviewsSubmittedCount, issuesClosedCount) are NOT
 *     compared — those legitimately differ by platform.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { REPO_DEPTH_THRESHOLD, buildStatsFromRaw } from "@chapa/shared";
import { buildStatsFromBitbucket } from "./bitbucket/stats-aggregation";
import { buildStatsFromGitlab } from "./gitlab/stats-aggregation";
import { buildStatsFromCodeberg } from "./codeberg/stats-aggregation";

// ---------------------------------------------------------------------------
// Shared fixture values
// ---------------------------------------------------------------------------

const FIXTURE_DATE = "2026-03-01T00:00:00.000Z";

// Three active dates, one with a spike (>= 30) to trigger maxCommitsIn10Min
const ACTIVE_DATES = [
  { date: "2026-02-01", count: 5 },
  { date: "2026-02-15", count: 35 }, // spike — maxCommitsIn10Min = 35
  { date: "2026-02-20", count: 8 },
];

// Two repos: one deep (>= REPO_DEPTH_THRESHOLD), one shallow
const DEEP_REPO_COMMITS = REPO_DEPTH_THRESHOLD + 5; // 8 — passes threshold
const SHALLOW_REPO_COMMITS = REPO_DEPTH_THRESHOLD - 1; // 2 — below threshold

// PR sizes used for weight computation — identical across all platforms
const PR_ADDITIONS = 100;
const PR_DELETIONS = 40;
const PR_CHANGED_FILES = 5;

// ---------------------------------------------------------------------------
// Invariant fields — the subset that computePlatformStats() controls
// ---------------------------------------------------------------------------

type InvariantFields = {
  activeDays: number;
  reposContributed: number;
  topRepoShare: number;
  maxCommitsIn10Min: number;
  commitsTotal: number;
  heatmapData: { date: string; count: number }[];
};

function extractInvariants(stats: ReturnType<typeof buildStatsFromBitbucket>): InvariantFields {
  return {
    activeDays: stats.activeDays,
    reposContributed: stats.reposContributed,
    topRepoShare: stats.topRepoShare,
    maxCommitsIn10Min: stats.maxCommitsIn10Min,
    commitsTotal: stats.commitsTotal,
    heatmapData: stats.heatmapData,
  };
}

// ---------------------------------------------------------------------------
// Platform-specific fixture builders
// ---------------------------------------------------------------------------

function makeBitbucketRaw() {
  // Bitbucket: heatmap built from commit array; each commit is one entry
  const commits = ACTIVE_DATES.flatMap(({ date, count }) =>
    Array.from({ length: count }, (_, i) => ({
      hash: `${date}-${i}`,
      date: `${date}T10:00:00.000Z`,
      message: "commit",
      author: { raw: "Dev <dev@example.com>", user: { username: "devuser" } },
    })),
  );

  const mergedPRs = [
    {
      pr: {
        id: 1,
        title: "PR 1",
        state: "MERGED" as const,
        author: { username: "devuser" },
        created_on: "2026-02-01T00:00:00.000Z",
        updated_on: "2026-02-01T00:00:00.000Z",
      },
      diffstat: [
        {
          status: "modified",
          lines_added: PR_ADDITIONS,
          lines_removed: PR_DELETIONS,
          new: { path: "src/index.ts" },
          // changedFiles derived from diffstat.length (1 entry)
        },
        // Pad to PR_CHANGED_FILES entries (5 total)
        ...Array.from({ length: PR_CHANGED_FILES - 1 }, (_, i) => ({
          status: "added",
          lines_added: 0,
          lines_removed: 0,
          new: { path: `src/file-${i}.ts` },
        })),
      ],
    },
  ];

  return {
    username: "devuser",
    displayName: "Dev User",
    avatarUrl: "https://bitbucket.org/avatar.png",
    commits,
    mergedPRs,
    reviewActivities: [],
    closedIssues: 3,
    repos: [
      { fullName: "devuser/deep-repo", commitCount: DEEP_REPO_COMMITS, isOwned: true, forkCount: 2 },
      { fullName: "devuser/shallow-repo", commitCount: SHALLOW_REPO_COMMITS, isOwned: false, forkCount: 0 },
    ],
  };
}

function makeGitlabRaw() {
  // GitLab: heatmap arrives pre-bucketed by date
  return {
    username: "devuser",
    displayName: "Dev User",
    avatarUrl: "https://gitlab.com/avatars/devuser",
    heatmap: ACTIVE_DATES.map(({ date, count }) => ({ date, count })),
    mergedPRs: [
      { additions: PR_ADDITIONS, deletions: PR_DELETIONS, changed_files: PR_CHANGED_FILES },
    ],
    reviewsCount: 0,
    closedIssues: 3,
    repos: [
      { fullName: "devuser/deep-repo", commitCount: DEEP_REPO_COMMITS, isOwned: true, starsCount: 5, forksCount: 2, watchersCount: 0 },
      { fullName: "devuser/shallow-repo", commitCount: SHALLOW_REPO_COMMITS, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
    ],
  };
}

function makeCodebergRaw() {
  // Codeberg: heatmap as Unix timestamps + contributions
  const codebergHeatmap = ACTIVE_DATES.map(({ date, count }) => ({
    timestamp: new Date(`${date}T10:00:00.000Z`).getTime() / 1000,
    contributions: count,
  }));

  return {
    username: "devuser",
    displayName: "Dev User",
    avatarUrl: "https://codeberg.org/avatars/devuser",
    heatmap: codebergHeatmap,
    mergedPRs: [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed" as const,
        merged: true,
        merged_at: "2026-02-01T12:00:00Z",
        additions: PR_ADDITIONS,
        deletions: PR_DELETIONS,
        changed_files: PR_CHANGED_FILES,
        user: { login: "devuser" },
      },
    ],
    reviews: [],
    closedIssues: 3,
    repos: [
      { fullName: "devuser/deep-repo", commitCount: DEEP_REPO_COMMITS, isOwned: true, starsCount: 5, forksCount: 2, watchersCount: 10 },
      { fullName: "devuser/shallow-repo", commitCount: SHALLOW_REPO_COMMITS, isOwned: false, starsCount: 0, forksCount: 0, watchersCount: 0 },
    ],
  };
}

// Total commits implied by ACTIVE_DATES counts (5 + 35 + 8) — matches the
// commitsTotal the other three fixtures derive from their heatmap/commit list.
const TOTAL_COMMITS = ACTIVE_DATES.reduce((sum, d) => sum + d.count, 0);

function makeGithubRaw(): Parameters<typeof buildStatsFromRaw>[0] {
  // GitHub: raw GraphQL-shaped contribution data (structurally different from
  // the NormalizedRepo/NormalizedMergedPr shape the other three platforms
  // share) but constructed with equivalent values so the invariant outputs
  // (activeDays, reposContributed, topRepoShare, maxCommitsIn10Min,
  // commitsTotal, heatmapData) must mathematically match. GitHub does NOT
  // delegate to computePlatformStats() (see #1024 comment above) — this
  // fixture proves its independently-computed outputs still agree.
  return {
    login: "devuser",
    name: "Dev User",
    avatarUrl: "https://github.com/avatars/devuser",
    // mergedPrTotalCount === the single merged PR node below, so
    // prsMergedCount (authoritative-count-sourced for GitHub) still matches
    // the other platforms' mergedPrs.length-sourced count in this fixture.
    mergedPrTotalCount: 1,
    contributionCalendar: {
      totalContributions: TOTAL_COMMITS,
      weeks: [
        {
          contributionDays: ACTIVE_DATES.map(({ date, count }) => ({
            date,
            contributionCount: count,
          })),
        },
      ],
    },
    pullRequests: {
      totalCount: 1,
      nodes: [
        {
          additions: PR_ADDITIONS,
          deletions: PR_DELETIONS,
          changedFiles: PR_CHANGED_FILES,
          merged: true,
          body: "PR body",
          headRefName: "feature/pr-1",
          baseRefName: "main",
          createdAt: "2026-02-01T00:00:00.000Z",
          mergedAt: "2026-02-01T12:00:00.000Z",
          closingIssuesCount: 0,
        },
      ],
    },
    reviews: { totalCount: 0 },
    issues: { totalCount: 3 },
    repositories: {
      totalCount: 2,
      nodes: [
        {
          nameWithOwner: "devuser/deep-repo",
          defaultBranchRef: { target: { history: { totalCount: DEEP_REPO_COMMITS } } },
        },
        {
          nameWithOwner: "devuser/shallow-repo",
          defaultBranchRef: { target: { history: { totalCount: SHALLOW_REPO_COMMITS } } },
        },
      ],
    },
    ownedRepoStars: {
      nodes: [{ stargazerCount: 5, forkCount: 2, watchers: { totalCount: 0 } }],
    },
  };
}

// ---------------------------------------------------------------------------
// Parity tests
// ---------------------------------------------------------------------------

describe("cross-platform aggregation parity (AR-S1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXTURE_DATE));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces identical activeDays across all four platforms", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // 3 active dates — all have count > 0
    expect(bb.activeDays).toBe(3);
    expect(gl.activeDays).toBe(bb.activeDays);
    expect(cb.activeDays).toBe(bb.activeDays);
    expect(gh.activeDays).toBe(bb.activeDays);
  });

  it("produces identical reposContributed across all four platforms", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // Only deep-repo (DEEP_REPO_COMMITS >= REPO_DEPTH_THRESHOLD) counts
    expect(bb.reposContributed).toBe(1);
    expect(gl.reposContributed).toBe(bb.reposContributed);
    expect(cb.reposContributed).toBe(bb.reposContributed);
    expect(gh.reposContributed).toBe(bb.reposContributed);
  });

  it("produces identical topRepoShare across all four platforms", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // deep-repo (8) / (8 + 2) = 0.8
    const expectedShare = DEEP_REPO_COMMITS / (DEEP_REPO_COMMITS + SHALLOW_REPO_COMMITS);
    expect(bb.topRepoShare).toBeCloseTo(expectedShare, 5);
    expect(gl.topRepoShare).toBeCloseTo(bb.topRepoShare, 5);
    expect(cb.topRepoShare).toBeCloseTo(bb.topRepoShare, 5);
    expect(gh.topRepoShare).toBeCloseTo(bb.topRepoShare, 5);
  });

  it("produces identical maxCommitsIn10Min across all four platforms (#1024: shared DAILY_COMMIT_SPIKE_THRESHOLD)", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // max daily count = 35 (>= 30 threshold) → maxCommitsIn10Min = 35
    expect(bb.maxCommitsIn10Min).toBe(35);
    expect(gl.maxCommitsIn10Min).toBe(bb.maxCommitsIn10Min);
    expect(cb.maxCommitsIn10Min).toBe(bb.maxCommitsIn10Min);
    expect(gh.maxCommitsIn10Min).toBe(bb.maxCommitsIn10Min);
  });

  it("produces identical heatmapData entries (sorted dates and counts)", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // All four should have 3 date entries in sorted order
    expect(bb.heatmapData).toHaveLength(3);
    expect(gl.heatmapData).toHaveLength(bb.heatmapData.length);
    expect(cb.heatmapData).toHaveLength(bb.heatmapData.length);
    expect(gh.heatmapData).toHaveLength(bb.heatmapData.length);

    // Dates must match exactly
    const bbDates = bb.heatmapData.map((d) => d.date);
    const glDates = gl.heatmapData.map((d) => d.date);
    const cbDates = cb.heatmapData.map((d) => d.date);
    const ghDates = gh.heatmapData.map((d) => d.date);
    expect(glDates).toEqual(bbDates);
    expect(cbDates).toEqual(bbDates);
    expect(ghDates).toEqual(bbDates);

    // Counts must match exactly
    const bbCounts = bb.heatmapData.map((d) => d.count);
    const glCounts = gl.heatmapData.map((d) => d.count);
    const cbCounts = cb.heatmapData.map((d) => d.count);
    const ghCounts = gh.heatmapData.map((d) => d.count);
    expect(glCounts).toEqual(bbCounts);
    expect(cbCounts).toEqual(bbCounts);
    expect(ghCounts).toEqual(bbCounts);
  });

  it("all invariant fields match when extracted together (including GitHub's independently-computed path)", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    const bbInvariants = extractInvariants(bb);
    const glInvariants = extractInvariants(gl);
    const cbInvariants = extractInvariants(cb);
    const ghInvariants = extractInvariants(gh);

    expect(glInvariants).toEqual(bbInvariants);
    expect(cbInvariants).toEqual(bbInvariants);
    // GitHub computes these via its own inline copy (buildStatsFromRaw), not
    // computePlatformStats() — this is the #1024 regression guard proving the
    // two independent code paths still agree on outputs for equivalent input.
    expect(ghInvariants).toEqual(bbInvariants);
  });

  it("produces identical PR-weight metrics across all four platforms (#983, extended to GitHub by #1024)", () => {
    // prsMergedWeight, linesAdded and linesDeleted are now computed by the
    // shared computePlatformStats() from equivalent normalized merged-PR inputs,
    // so they must be byte-for-byte identical across Bitbucket/GitLab/Codeberg.
    // This guards the #983 extraction of the PR aggregation loop out of the
    // per-platform files. GitHub computes these from its own merged-PR sample
    // via the same computePrWeight() formula (see stats-aggregation.ts) — with
    // an equivalent single PR fixture, the totals must still match.
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // All four fixtures carry one PR of PR_ADDITIONS/PR_DELETIONS/PR_CHANGED_FILES.
    expect(bb.linesAdded).toBe(PR_ADDITIONS);
    expect(bb.linesDeleted).toBe(PR_DELETIONS);
    expect(bb.prsMergedWeight).toBeGreaterThan(0);

    expect(gl.linesAdded).toBe(bb.linesAdded);
    expect(cb.linesAdded).toBe(bb.linesAdded);
    expect(gh.linesAdded).toBe(bb.linesAdded);
    expect(gl.linesDeleted).toBe(bb.linesDeleted);
    expect(cb.linesDeleted).toBe(bb.linesDeleted);
    expect(gh.linesDeleted).toBe(bb.linesDeleted);
    expect(gl.prsMergedWeight).toBeCloseTo(bb.prsMergedWeight, 10);
    expect(cb.prsMergedWeight).toBeCloseTo(bb.prsMergedWeight, 10);
    expect(gh.prsMergedWeight).toBeCloseTo(bb.prsMergedWeight, 10);
    expect(gl.prsMergedCount).toBe(bb.prsMergedCount);
    expect(cb.prsMergedCount).toBe(bb.prsMergedCount);
    // GitHub's prsMergedCount is sourced from the authoritative
    // mergedPrTotalCount (#1004), not mergedPrs.length — deliberately set to
    // 1 in this fixture to match, but this is NOT the same code path as the
    // other three platforms and must never be conflated with it.
    expect(gh.prsMergedCount).toBe(bb.prsMergedCount);
  });

  it("does NOT assert equality on platform-specific fields (smoke check)", () => {
    const bb = buildStatsFromBitbucket(makeBitbucketRaw());
    const gl = buildStatsFromGitlab(makeGitlabRaw());
    const cb = buildStatsFromCodeberg(makeCodebergRaw());
    const gh = buildStatsFromRaw(makeGithubRaw());

    // Bitbucket has no stars — this should differ from Codeberg/GitLab
    expect(bb.totalStars).toBe(0);
    expect(gl.totalStars).toBe(5);
    expect(cb.totalStars).toBe(5);
    expect(gh.totalStars).toBe(5);

    // Bitbucket has no watchers — Codeberg does
    expect(bb.totalWatchers).toBe(0);
    expect(gl.totalWatchers).toBe(0); // GitLab also 0
    expect(cb.totalWatchers).toBe(10);
    expect(gh.totalWatchers).toBe(0);
  });

  it("maxCommitsIn10Min is 0 when no day exceeds threshold (all four platforms)", () => {
    // Fixture with all counts < 30
    const quietDates = [
      { date: "2026-02-01", count: 5 },
      { date: "2026-02-15", count: 10 },
    ];

    const bbQuiet = buildStatsFromBitbucket({
      ...makeBitbucketRaw(),
      commits: quietDates.flatMap(({ date, count }) =>
        Array.from({ length: count }, (_, i) => ({
          hash: `${date}-${i}`,
          date: `${date}T10:00:00.000Z`,
          message: "commit",
          author: { raw: "Dev <dev@example.com>", user: { username: "devuser" } },
        })),
      ),
    });

    const glQuiet = buildStatsFromGitlab({
      ...makeGitlabRaw(),
      heatmap: quietDates,
    });

    const cbQuiet = buildStatsFromCodeberg({
      ...makeCodebergRaw(),
      heatmap: quietDates.map(({ date, count }) => ({
        timestamp: new Date(`${date}T10:00:00.000Z`).getTime() / 1000,
        contributions: count,
      })),
    });

    const ghQuiet = buildStatsFromRaw({
      ...makeGithubRaw(),
      contributionCalendar: {
        totalContributions: quietDates.reduce((sum, d) => sum + d.count, 0),
        weeks: [
          {
            contributionDays: quietDates.map(({ date, count }) => ({
              date,
              contributionCount: count,
            })),
          },
        ],
      },
    });

    expect(bbQuiet.maxCommitsIn10Min).toBe(0);
    expect(glQuiet.maxCommitsIn10Min).toBe(0);
    expect(cbQuiet.maxCommitsIn10Min).toBe(0);
    expect(ghQuiet.maxCommitsIn10Min).toBe(0);
  });

  it("reposContributed is 0 when all repos are below threshold (all four platforms)", () => {
    const shallowRepos = [
      { fullName: "devuser/a", commitCount: 1, isOwned: true, forkCount: 0, starsCount: 0, forksCount: 0, watchersCount: 0 },
      { fullName: "devuser/b", commitCount: 2, isOwned: false, forkCount: 0, starsCount: 0, forksCount: 0, watchersCount: 0 },
    ];

    const bb = buildStatsFromBitbucket({
      ...makeBitbucketRaw(),
      repos: shallowRepos.map(({ fullName, commitCount, isOwned, forkCount }) => ({
        fullName, commitCount, isOwned, forkCount,
      })),
    });
    const gl = buildStatsFromGitlab({
      ...makeGitlabRaw(),
      repos: shallowRepos.map(({ fullName, commitCount, isOwned, starsCount, forksCount, watchersCount }) => ({
        fullName, commitCount, isOwned, starsCount, forksCount, watchersCount,
      })),
    });
    const cb = buildStatsFromCodeberg({
      ...makeCodebergRaw(),
      repos: shallowRepos.map(({ fullName, commitCount, isOwned, starsCount, forksCount, watchersCount }) => ({
        fullName, commitCount, isOwned, starsCount, forksCount, watchersCount,
      })),
    });
    const gh = buildStatsFromRaw({
      ...makeGithubRaw(),
      repositories: {
        totalCount: shallowRepos.length,
        nodes: shallowRepos.map(({ fullName, commitCount }) => ({
          nameWithOwner: fullName,
          defaultBranchRef: { target: { history: { totalCount: commitCount } } },
        })),
      },
    });

    expect(bb.reposContributed).toBe(0);
    expect(gl.reposContributed).toBe(bb.reposContributed);
    expect(cb.reposContributed).toBe(bb.reposContributed);
    expect(gh.reposContributed).toBe(bb.reposContributed);
  });

  it("topRepoShare is 0 when there are no active repos (all four platforms)", () => {
    const emptyRepos: never[] = [];

    const bb = buildStatsFromBitbucket({ ...makeBitbucketRaw(), repos: emptyRepos });
    const gl = buildStatsFromGitlab({ ...makeGitlabRaw(), repos: emptyRepos });
    const cb = buildStatsFromCodeberg({ ...makeCodebergRaw(), repos: emptyRepos });
    const gh = buildStatsFromRaw({
      ...makeGithubRaw(),
      repositories: { totalCount: 0, nodes: [] },
    });

    expect(bb.topRepoShare).toBe(0);
    expect(gl.topRepoShare).toBe(bb.topRepoShare);
    expect(cb.topRepoShare).toBe(bb.topRepoShare);
    expect(gh.topRepoShare).toBe(bb.topRepoShare);
  });
});
