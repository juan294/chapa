import type { ImpactV4Result, DeveloperArchetype } from "@chapa/shared";

const DIMENSION_LABELS: Record<string, string> = {
  building: "Building",
  guarding: "Guarding",
  consistency: "Consistency",
  breadth: "Breadth",
};

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  building: "Shipping meaningful changes — PRs merged, issues closed, commits",
  guarding: "Reviewing & quality gatekeeping — code reviews, review ratio",
  consistency: "Reliable, sustained contributions — active days, even distribution",
  breadth: "Cross-project influence — repos contributed, diversity of work",
};

const ARCHETYPE_DESCRIPTIONS: Record<DeveloperArchetype, string> = {
  Builder: "You ship. PRs merged, issues closed, meaningful code changes — building is your strongest dimension.",
  Guardian: "You protect quality. Code reviews and gatekeeping are where you make the biggest impact.",
  Marathoner: "You show up. Consistent, sustained activity over time — reliability is your hallmark.",
  Polymath: "You reach across projects. Contributing to multiple repos and diverse work areas sets you apart.",
  Balanced: "You do it all. Your dimensions are well-rounded with no single weakness.",
  Emerging: "You're getting started. Keep contributing and your profile will take shape.",
};

export function ImpactBreakdown({ impact }: { impact: ImpactV4Result }) {
  const dims = impact.dimensions;

  return (
    <div className="space-y-8">
      {/* Archetype + Composite */}
      <div className="flex items-baseline gap-4">
        <span className="font-heading text-3xl font-extrabold text-amber">
          {impact.archetype}
        </span>
        <span className="font-heading text-2xl text-text-primary">
          {impact.adjustedComposite}
          <span className="text-text-secondary text-lg"> / 100</span>
        </span>
        <span className="text-sm text-text-secondary font-heading">
          {impact.tier}
        </span>
      </div>

      {/* Archetype description */}
      <p className="text-sm text-text-secondary leading-relaxed border-l-2 border-amber/30 pl-3">
        {ARCHETYPE_DESCRIPTIONS[impact.archetype]}
      </p>

      {/* Confidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Confidence</span>
          <span className="font-heading text-sm text-text-primary">
            {impact.confidence}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-track">
          <div
            className="h-2 rounded-full bg-amber"
            role="progressbar"
            aria-valuenow={impact.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Confidence score"
            style={{ width: `${impact.confidence}%` }}
          />
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-4">
        <h3 className="font-heading text-sm tracking-widest uppercase text-amber">
          Dimension Scores
        </h3>
        {(["building", "guarding", "consistency", "breadth"] as const).map(
          (key) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  {DIMENSION_LABELS[key]}
                </span>
                <span className="text-text-primary font-heading font-bold">
                  {dims[key]}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-track">
                <div
                  className="h-1.5 rounded-full bg-amber/60"
                  role="progressbar"
                  aria-valuenow={dims[key]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${DIMENSION_LABELS[key]} score`}
                  style={{ width: `${dims[key]}%` }}
                />
              </div>
              <div className="text-xs text-text-secondary/60">
                {DIMENSION_DESCRIPTIONS[key]}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Confidence reasons */}
      {impact.confidencePenalties.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-sm tracking-widest uppercase text-amber">
            Confidence Notes
          </h3>
          {impact.confidencePenalties.map((p) => (
            <p
              key={p.flag}
              className="text-sm text-text-secondary leading-relaxed border-l-2 border-amber/20 pl-3"
            >
              {p.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
