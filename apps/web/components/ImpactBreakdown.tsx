import type { ImpactV4Result, DeveloperArchetype, StatsData } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";

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
  building: { from: "#22c55e", to: "#86efac" },
  guarding: { from: "#f97316", to: "#fdba74" },
  consistency: { from: "#06b6d4", to: "#67e8f9" },
  breadth: { from: "#ec4899", to: "#f9a8d4" },
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
        <div className="grid grid-cols-2 gap-3">
          {(["building", "guarding", "consistency", "breadth"] as const).map(
            (key, i) => (
              <div
                key={key}
                className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up"
                style={{ animationDelay: `${400 + i * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-text-secondary uppercase tracking-wider">
                    {DIMENSION_LABELS[key]}
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
                      background: `linear-gradient(to right, ${DIMENSION_COLORS[key].from}, ${DIMENSION_COLORS[key].to})`,
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
              className="rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up"
              style={{ animationDelay: `${700 + i * 60}ms` }}
            >
              <div className="font-heading text-2xl font-extrabold text-text-primary leading-none">
                {formatCompact(stat.value)}
              </div>
              <div className="text-xs text-text-secondary uppercase tracking-wider mt-1.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Confidence ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary">
            Confidence
          </h3>
          <span className="font-heading text-sm font-bold text-text-primary">
            {impact.confidence}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-track">
          <div
            className="h-1.5 rounded-full bg-amber animate-bar-fill"
            role="progressbar"
            aria-valuenow={impact.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Confidence score"
            style={{
              width: `${impact.confidence}%`,
              animationDelay: "1200ms",
            }}
          />
        </div>
        {impact.confidencePenalties.length > 0 && (
          <div className="space-y-2 pt-1">
            {impact.confidencePenalties.map((p) => (
              <p
                key={p.flag}
                className="text-xs text-text-secondary leading-relaxed pl-3 border-l border-amber/20"
              >
                {p.reason}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
