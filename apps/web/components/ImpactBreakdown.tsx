import type { ImpactV4Result, DeveloperArchetype, StatsData, Platform } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import { InfoTooltip } from "./InfoTooltip";

const DIMENSION_LABELS: Record<string, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

const DIMENSION_SUBTITLES: Record<string, string> = {
  delivery: "PRs merged \u00b7 issues closed \u00b7 commits",
  quality: "Code reviews \u00b7 quality gatekeeping",
  consistency: "Active days \u00b7 sustained contributions",
  breadth: "Repos contributed \u00b7 community reach",
};

const DIMENSION_COLORS: Record<string, { from: string; to: string }> = {
  delivery: { from: "var(--color-dimension-delivery)", to: "var(--color-dimension-delivery-light)" },
  quality: { from: "var(--color-dimension-quality)", to: "var(--color-dimension-quality-light)" },
  consistency: { from: "var(--color-dimension-consistency)", to: "var(--color-dimension-consistency-light)" },
  breadth: { from: "var(--color-dimension-breadth)", to: "var(--color-dimension-breadth-light)" },
};


const DIMENSION_TOOLTIPS: Record<string, { id: string; tip: string }> = {
  delivery: {
    id: "dim-delivery",
    tip: "Measures shipping output: PRs merged, issues closed, and commits. High score = consistently turning ideas into merged code.",
  },
  quality: {
    id: "dim-quality",
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

const PLATFORM_DISPLAY: Record<Platform, { label: string; svgPath: string; viewBox: string }> = {
  github: {
    label: "GitHub",
    svgPath: "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 01-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 010 8c0-4.42 3.58-8 8-8z",
    viewBox: "0 0 16 16",
  },
  bitbucket: {
    label: "Bitbucket",
    svgPath: "M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z",
    viewBox: "0 0 24 24",
  },
  codeberg: {
    label: "Codeberg",
    svgPath: "M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z",
    viewBox: "0 0 24 24",
  },
};

const PLATFORM_URLS: Record<Platform, (handle: string) => string> = {
  github: (handle) => `https://github.com/${handle}`,
  bitbucket: (handle) => `https://bitbucket.org/${handle}`,
  codeberg: (handle) => `https://codeberg.org/${handle}`,
};

interface DataSourcesProps {
  stats: StatsData;
  handle: string;
}

export function DataSources({ stats, handle }: DataSourcesProps) {
  const platforms: Platform[] = [
    "github",
    ...(stats.linkedPlatforms?.filter((p): p is Platform => p !== "github") ?? []),
  ];

  return (
    <div>
      <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up [animation-delay:260ms]">
        Data Sources
      </h3>
      <div className="flex flex-wrap gap-3">
        {platforms.map((platform, i) => {
          const display = PLATFORM_DISPLAY[platform];
          if (!display) return null;
          return (
            <a
              key={platform}
              href={PLATFORM_URLS[platform](handle)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-card px-3 py-2 animate-fade-in-up transition-colors hover:border-amber/30 hover:text-amber"
              style={{ animationDelay: `${280 + i * 80}ms` }}
            >
              <svg
                width="16"
                height="16"
                viewBox={display.viewBox}
                fill="currentColor"
                className="text-text-secondary"
                aria-hidden="true"
              >
                <path d={display.svgPath} />
              </svg>
              <span className="text-sm text-text-primary font-medium">
                {display.label}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

const ARCHETYPE_PROFILES: Record<DeveloperArchetype, string> = {
  Builder:
    "Your profile is driven by output \u2014 you turn ideas into merged pull requests and closed issues at a pace that keeps the roadmap moving. Delivery is clearly your dominant dimension, meaning you thrive when shipping features and moving codebases forward.",
  "Quality Champion":
    "Your profile is shaped by quality \u2014 you\u2019re the one reviewing pull requests, catching edge cases, and making sure nothing ships that shouldn\u2019t. Quality is your dominant dimension, and your team\u2019s code quality reflects it.",
  Marathoner:
    "Your profile is defined by consistency \u2014 you show up day after day with steady, sustained contributions that compound over time. Consistency is your dominant dimension, making you the reliable backbone of any team.",
  Polymath:
    "Your profile is marked by reach \u2014 you contribute across multiple repositories and technology areas, connecting the dots between projects. Breadth is your dominant dimension, giving you a uniquely wide perspective.",
  Balanced:
    "Your profile is impressively well-rounded \u2014 no single dimension dominates because you invest across delivery, reviewing, consistency, and breadth. This balance makes you versatile and adaptable to any team need.",
  Emerging:
    "Your profile is still taking shape \u2014 with more contributions over the coming months, your strongest dimensions will emerge and reveal your developer identity. Every commit, review, and repo you touch sharpens the picture.",
};

const DIMENSION_TIPS: Record<string, string> = {
  delivery: "To strengthen Delivery, focus on opening and merging more pull requests \u2014 even small, focused PRs that close open issues count significantly.",
  quality: "To strengthen Quality, start reviewing teammates\u2019 pull requests more often \u2014 thoughtful code reviews are the fastest way to grow this dimension.",
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
          {(["delivery", "quality", "consistency", "breadth"] as const).map(
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
