import {
  type TierData,
  type TierName,
  HEATMAP_COLS,
  HEATMAP_ROWS,
  generateHeatmap,
  heatmapColor,
  tierPillClasses,
  tierLabel,
} from "./tier-data";

/* ── Sparkle dot component (Elite only) ───────────────────── */

function SparkleDots() {
  return (
    <>
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-amber-light"
        style={{ top: "12%", right: "8%", animationDelay: "0s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-[3px] h-[3px] rounded-full bg-amber"
        style={{ bottom: "18%", left: "6%", animationDelay: "0.7s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-amber-light"
        style={{ top: "45%", right: "3%", animationDelay: "1.4s" }}
        aria-hidden="true"
      />
    </>
  );
}

/* ── Badge card component ─────────────────────────────────── */

interface BadgeCardProps {
  data: TierData;
  /** Override score for animated transitions */
  scoreOverride?: number;
  /** Override tier for animated transitions */
  tierOverride?: TierName;
}

export function BadgeCard({ data, scoreOverride, tierOverride }: BadgeCardProps) {
  const activeTier = tierOverride ?? data.tier;
  const activeScore = scoreOverride ?? data.score;
  const heatmap = generateHeatmap(data.heatmapDensity);

  return (
    <div className="relative">
      {/* Tier label above card */}
      <div className="text-center mb-3">
        <span
          className={`text-xs tracking-[0.2em] font-semibold font-heading ${
            activeTier === "Emerging"
              ? "text-text-secondary"
              : activeTier === "Solid"
                ? "text-text-primary/70"
                : "text-amber"
          }`}
        >
          {tierLabel(activeTier)}
        </span>
      </div>

      {/* Card wrapper with tier-specific border/glow */}
      <div
        className={`tier-card tier-card-${activeTier.toLowerCase()} relative rounded-2xl`}
      >
        {/* Elite: animated border pseudo-element */}
        {activeTier === "Elite" && (
          <div
            className="elite-border-glow absolute -inset-[2px] rounded-[18px] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Elite: sparkle dots */}
        {activeTier === "Elite" && <SparkleDots />}

        {/* High: warm ambient glow behind card */}
        {activeTier === "High" && (
          <div
            className="absolute -inset-4 rounded-3xl bg-amber/[0.04] blur-[20px] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Card body */}
        <div className="relative z-10 rounded-2xl bg-card p-4 sm:p-5 w-full aspect-[1200/630] flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-heading text-[10px] sm:text-xs text-text-secondary truncate">
              {data.handle}
            </span>
            <span className="font-heading text-[10px] sm:text-xs font-bold text-amber">
              Chapa.
            </span>
          </div>

          {/* Main: heatmap + score */}
          <div className="flex-1 flex items-center gap-3 sm:gap-5 py-2 sm:py-3">
            {/* Heatmap grid */}
            <div className="flex-1 min-w-0">
              <div
                className="grid gap-[1.5px] sm:gap-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)`,
                }}
                role="img"
                aria-label={`Activity heatmap for ${data.handle}`}
              >
                {heatmap.flat().map((level, i) => (
                  <div
                    key={i}
                    className="rounded-[1.5px] sm:rounded-[2px] aspect-square"
                    style={{ backgroundColor: heatmapColor(level, activeTier) }}
                  />
                ))}
              </div>
            </div>

            {/* Score + tier pill */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={`font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold leading-none tier-score tier-score-${activeTier.toLowerCase()}`}
              >
                {Math.round(activeScore)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase ${tierPillClasses(activeTier)}`}
              >
                {activeTier}
              </span>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-text-secondary text-[8px] sm:text-[10px] font-medium">
            <span>{data.stars} stars</span>
            <span className="text-amber/30" aria-hidden="true">|</span>
            <span>{data.forks} forks</span>
            <span className="text-amber/30" aria-hidden="true">|</span>
            <span>{data.watchers} watchers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
