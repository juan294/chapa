import type { ImpactV4Result, DeveloperArchetype, StatsData } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import { InfoTooltip } from "./InfoTooltip";

const DIMENSION_LABELS: Record<string, string> = {
  building: "Building",
  guarding: "Guarding",
  consistency: "Consistency",
  breadth: "Breadth",
};

const DIMENSION_SUBTITLES: Record<string, string> = {
  building: "PRs merged \u00b7 issues closed \u00b7 commits",
  guarding: "Code reviews \u00b7 quality gatekeeping",
  consistency: "Active days \u00b7 sustained contributions",
  breadth: "Repos contributed \u00b7 community reach",
};

const DIMENSION_COLORS: Record<string, { from: string; to: string }> = {
  building: { from: "var(--color-dimension-building)", to: "var(--color-dimension-building-light)" },
  guarding: { from: "var(--color-dimension-guarding)", to: "var(--color-dimension-guarding-light)" },
  consistency: { from: "var(--color-dimension-consistency)", to: "var(--color-dimension-consistency-light)" },
  breadth: { from: "var(--color-dimension-breadth)", to: "var(--color-dimension-breadth-light)" },
};


const DIMENSION_TOOLTIPS: Record<string, { id: string; tip: string }> = {
  building: {
    id: "dim-building",
    tip: "Measures shipping output: PRs merged, issues closed, and commits. High score = consistently turning ideas into merged code.",
  },
  guarding: {
    id: "dim-guarding",
    tip: "Measures code review impact: reviews submitted and review quality. High score = actively protecting code quality.",
  },
  consistency: {
    id: "dim-consistency",
    tip: "Measures contribution steadiness: active days and even distribution across weeks. High score = reliable, sustained output.",
  },
  breadth: {
    id: "dim-breadth",
    tip: "Measures cross-project reach: repos contributed to, project diversity, and community metrics (stars, forks, watchers).",
  },
};

const STAT_TOOLTIPS: Record<string, { id: string; tip: string }> = {
  Stars: { id: "stat-stars", tip: "Stars received on your repos \u2014 not repos you\u2019ve starred yourself." },
  Forks: { id: "stat-forks", tip: "Times other developers forked your repositories." },
  Watchers: { id: "stat-watchers", tip: "People watching your repos for activity notifications." },
  "Active Days": { id: "stat-active-days", tip: "Unique days with at least one contribution in the last 365 days." },
  Commits: { id: "stat-commits", tip: "Commits pushed across all repos in the last 365 days." },
  "PRs Merged": { id: "stat-prs-merged", tip: "Pull requests you authored that were merged in the last 365 days." },
  Reviews: { id: "stat-reviews", tip: "Code reviews submitted on others\u2019 PRs in the last 365 days." },
  Repos: { id: "stat-repos", tip: "Distinct repositories you contributed to in the last 365 days." },
};

const ARCHETYPE_PROFILES: Record<DeveloperArchetype, string> = {
  Builder:
    "Your profile is driven by output \u2014 you turn ideas into merged pull requests and closed issues at a pace that keeps the roadmap moving. Building is clearly your dominant dimension, meaning you thrive when shipping features and moving codebases forward.",
  Guardian:
    "Your profile is shaped by quality \u2014 you\u2019re the one reviewing pull requests, catching edge cases, and making sure nothing ships that shouldn\u2019t. Guarding is your dominant dimension, and your team\u2019s code quality reflects it.",
  Marathoner:
    "Your profile is defined by consistency \u2014 you show up day after day with steady, sustained contributions that compound over time. Consistency is your dominant dimension, making you the reliable backbone of any team.",
  Polymath:
    "Your profile is marked by reach \u2014 you contribute across multiple repositories and technology areas, connecting the dots between projects. Breadth is your dominant dimension, giving you a uniquely wide perspective.",
  Balanced:
    "Your profile is impressively well-rounded \u2014 no single dimension dominates because you invest across building, reviewing, consistency, and breadth. This balance makes you versatile and adaptable to any team need.",
  Emerging:
    "Your profile is still taking shape \u2014 with more contributions over the coming months, your strongest dimensions will emerge and reveal your developer identity. Every commit, review, and repo you touch sharpens the picture.",
};

const DIMENSION_TIPS: Record<string, string> = {
  building: "To strengthen Building, focus on opening and merging more pull requests \u2014 even small, focused PRs that close open issues count significantly.",
  guarding: "To strengthen Guarding, start reviewing teammates\u2019 pull requests more often \u2014 thoughtful code reviews are the fastest way to grow this dimension.",
  consistency: "To strengthen Consistency, aim for regular contributions across more days \u2014 even small commits on consecutive days build this dimension faster than occasional bursts.",
  breadth: "To strengthen Breadth, contribute to repos outside your main project \u2014 opening issues, submitting PRs, or reviewing code in other repositories all count.",
};

/**
 * Generate a rich profile description with archetype context and an
 * actionable tip for the developer\u2019s weakest dimension.
 */
export function getArchetypeProfile(impact: ImpactV4Result): string {
  const profile = ARCHETYPE_PROFILES[impact.archetype];
  const dims = impact.dimensions;

  // Find the weakest dimension (skip for Balanced/Emerging — tips don't apply the same way)
  if (impact.archetype === "Balanced" || impact.archetype === "Emerging") {
    return profile;
  }

  const entries = Object.entries(dims) as [string, number][];
  const weakest = entries.reduce((min, curr) => (curr[1] < min[1] ? curr : min));
  const tip = DIMENSION_TIPS[weakest[0]];

  return `${profile} ${tip}`;
}

interface ImpactBreakdownProps {
  impact: ImpactV4Result;
  stats: StatsData;
}

export function ImpactBreakdown({ impact, stats }: ImpactBreakdownProps) {
  const dims = impact.dimensions;

  return (
    <div className="space-y-10">
      {/* ── Dimension Cards ────────────────────────────────── */}
      <div>
        <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4">
          Performance Dimensions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["building", "guarding", "consistency", "breadth"] as const).map(
            (key, i) => (
              <div
                key={key}
                className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up relative hover:z-10 focus-within:z-10"
                style={{ animationDelay: `${400 + i * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-text-secondary uppercase tracking-wider flex items-center gap-1">
                    {DIMENSION_LABELS[key]}
                    <InfoTooltip
                      id={DIMENSION_TOOLTIPS[key]!.id}
                      content={DIMENSION_TOOLTIPS[key]!.tip}
                    />
                  </span>
                  <span className="font-heading text-3xl font-extrabold text-text-primary leading-none">
                    {dims[key]}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full animate-bar-fill"
                    role="progressbar"
                    aria-valuenow={dims[key]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${DIMENSION_LABELS[key]} score`}
                    style={{
                      width: `${dims[key]}%`,
                      background: `linear-gradient(to right, ${DIMENSION_COLORS[key]!.from}, ${DIMENSION_COLORS[key]!.to})`,
                      animationDelay: `${600 + i * 100}ms`,
                    }}
                  />
                </div>
                <p className="text-xs text-text-secondary/50 mt-2.5 leading-relaxed">
                  {DIMENSION_SUBTITLES[key]}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div>
        <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4">
          Key Numbers
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: stats.totalStars, label: "Stars" },
            { value: stats.totalForks, label: "Forks" },
            { value: stats.totalWatchers, label: "Watchers" },
            { value: stats.activeDays, label: "Active Days" },
            { value: stats.commitsTotal, label: "Commits" },
            { value: stats.prsMergedCount, label: "PRs Merged" },
            { value: stats.reviewsSubmittedCount, label: "Reviews" },
            { value: stats.reposContributed, label: "Repos" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up relative hover:z-10 focus-within:z-10"
              style={{ animationDelay: `${700 + i * 60}ms` }}
            >
              <div className="font-heading text-2xl font-extrabold text-text-primary leading-none">
                {formatCompact(stat.value)}
              </div>
              <div className="text-xs text-text-secondary uppercase tracking-wider mt-1.5 flex items-center justify-center gap-1">
                {stat.label}
                {STAT_TOOLTIPS[stat.label] && (
                  <InfoTooltip
                    id={STAT_TOOLTIPS[stat.label]!.id}
                    content={STAT_TOOLTIPS[stat.label]!.tip}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
