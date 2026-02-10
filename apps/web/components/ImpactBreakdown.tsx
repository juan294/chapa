"use client";

import type { ImpactV3Result } from "@chapa/shared";

const SIGNAL_LABELS: Record<string, string> = {
  commits: "Commits",
  prWeight: "PRs Merged",
  reviews: "Code Reviews",
  issues: "Issues Closed",
  streak: "Active Days",
  collaboration: "Cross-Repo",
};

const SIGNAL_WEIGHTS: Record<string, number> = {
  commits: 0.12,
  prWeight: 0.33,
  reviews: 0.22,
  issues: 0.10,
  streak: 0.13,
  collaboration: 0.10,
};

export function ImpactBreakdown({ impact }: { impact: ImpactV3Result }) {
  const breakdown = impact.breakdown;

  return (
    <div className="space-y-8">
      {/* Tier + Score */}
      <div className="flex items-baseline gap-4">
        <span className="font-heading text-4xl font-extrabold text-amber">
          {impact.tier}
        </span>
        <span className="font-heading text-2xl text-text-primary">
          {impact.adjustedScore}
          <span className="text-text-secondary text-lg"> / 100</span>
        </span>
      </div>

      {/* Confidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Confidence</span>
          <span className="font-heading text-sm text-text-primary">
            {impact.confidence}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-warm-card">
          <div
            className="h-2 rounded-full bg-amber"
            style={{ width: `${impact.confidence}%` }}
          />
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-4">
        <h3 className="text-sm tracking-widest uppercase text-amber">
          Score Breakdown
        </h3>
        {Object.entries(breakdown).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {SIGNAL_LABELS[key] ?? key}
              </span>
              <span className="text-text-primary font-heading">
                {Math.round(value * 100)}%
                <span className="text-text-secondary text-xs ml-1">
                  (×{SIGNAL_WEIGHTS[key]?.toFixed(2)})
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-warm-card">
              <div
                className="h-1.5 rounded-full bg-amber/60"
                style={{ width: `${Math.round(value * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confidence reasons */}
      {impact.confidencePenalties.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm tracking-widest uppercase text-amber">
            Confidence Notes
          </h3>
          {impact.confidencePenalties.map((p) => (
            <p
              key={p.flag}
              className="text-sm text-text-secondary leading-relaxed border-l-2 border-warm-stroke pl-3"
            >
              {p.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
