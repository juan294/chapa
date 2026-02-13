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

export const ARCHETYPE_DESCRIPTIONS: Record<DeveloperArchetype, string> = {
  Builder:
    "You ship. PRs merged, issues closed, meaningful code changes \u2014 building is your strongest dimension.",
  Guardian:
    "You protect quality. Code reviews and gatekeeping are where you make the biggest impact.",
  Marathoner:
    "You show up. Consistent, sustained activity over time \u2014 reliability is your hallmark.",
  Polymath:
    "You reach across projects. Contributing to multiple repos and diverse work areas sets you apart.",
  Balanced:
    "You do it all. Your dimensions are well-rounded with no single weakness.",
  Emerging:
    "You\u2019re getting started. Keep contributing and your profile will take shape.",
};

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
        <h3 className="font-heading text-[11px] tracking-[0.2em] uppercase text-text-secondary mb-4">
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
                  <span className="text-[11px] text-text-secondary uppercase tracking-wider">
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
                <p className="text-[10px] text-text-secondary/50 mt-2.5 leading-relaxed">
                  {DIMENSION_SUBTITLES[key]}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div>
        <h3 className="font-heading text-[11px] tracking-[0.2em] uppercase text-text-secondary mb-4">
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
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-1.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Confidence ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-[11px] tracking-[0.2em] uppercase text-text-secondary">
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
