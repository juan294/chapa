import type { Insight } from "@/lib/dashboard/generate-insights";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InsightCardProps {
  insight: Insight;
  animationDelay?: number;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, stroke-based, use currentColor)
// ---------------------------------------------------------------------------

function TrendingUpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <path
        d="M2 17L8 11L12 15L18 3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="18 3 18 9"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 3 12 3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TrendingDownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <path
        d="M2 3L8 9L12 5L18 17"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="18 17 18 11"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="18 17 12 17"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TargetIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <circle cx="10" cy="10" r="8" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrophyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <path
        d="M6 2H14V8C14 11.3 12.2 13 10 13C7.8 13 6 11.3 6 8V2Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 2H6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 2H16" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 2C4 4 5 5 6 5"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 2C16 4 15 5 14 5"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M8 13V15" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13V15" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 15H14" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LightbulbIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <path d="M9 18H11" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 2V3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 10H4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 10H17" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5.6 5.6L6.3 6.3"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.4 5.6L13.7 6.3"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 14C6.3 13 5 11.2 5 9A5 5 0 1110 4A5 5 0 0115 9C15 11.2 13.7 13 12 14V15H8V14Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
    >
      <path
        d="M10 18V2"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9L10 2L17 9"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Archetype color resolution
// ---------------------------------------------------------------------------

const ARCHETYPE_COLOR_MAP: Record<string, string> = {
  Builder: "var(--color-archetype-builder)",
  "Quality Champion": "var(--color-archetype-guardian)",
  Marathoner: "var(--color-archetype-marathoner)",
  Polymath: "var(--color-archetype-polymath)",
  Balanced: "var(--color-archetype-balanced)",
  Emerging: "var(--color-archetype-emerging)",
  Artificer: "var(--color-archetype-artificer)",
};

function resolveArchetypeColor(headline: string): string {
  const match = headline.match(/You're (?:a |an )?(.+)/);
  const name = match?.[1];
  if (name) {
    return ARCHETYPE_COLOR_MAP[name] ?? "var(--color-amber)";
  }
  return "var(--color-amber)";
}

// ---------------------------------------------------------------------------
// Tier progress bar helpers
// ---------------------------------------------------------------------------

const TIER_LIST = ["Emerging", "Solid", "High", "Elite"];

function parseNextTier(
  headline: string,
): { gap: number; nextTier: string; currentIndex: number; nextIndex: number } | null {
  const match = headline.match(/^(\d+)\s+points?\s+to\s+(\w+)/i);
  const gapStr = match?.[1];
  const nextTier = match?.[2];
  if (!gapStr || !nextTier) return null;

  const gap = parseInt(gapStr, 10);
  const nextIndex = TIER_LIST.indexOf(nextTier);
  if (nextIndex < 1) return null;

  return { gap, nextTier, currentIndex: nextIndex - 1, nextIndex };
}

// ---------------------------------------------------------------------------
// Type-specific renderers
// ---------------------------------------------------------------------------

/** Achievement — celebratory banner with green glow + shimmer */
function AchievementCard({ insight, animationDelay = 0 }: InsightCardProps) {
  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className="relative rounded-xl border border-terminal-green/20 bg-terminal-green/[0.04] p-5 animate-fade-in-up overflow-hidden"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Animated shimmer sweep */}
      <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-terminal-green/10 to-transparent pointer-events-none" />

      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-terminal-green/10 flex items-center justify-center text-terminal-green">
          <TrophyIcon size={22} />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-terminal-green">
            {insight.headline}
          </p>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Trend — compact metric card with tinted icon container */
function TrendCard({ insight, animationDelay = 0 }: InsightCardProps) {
  const dimColor = insight.dimension
    ? `var(--color-dimension-${insight.dimension})`
    : undefined;
  const isUp = insight.icon === "trending-up";
  const accentColor =
    dimColor ??
    (isUp ? "var(--color-terminal-green)" : "var(--color-terminal-yellow)");

  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
          data-testid="trend-icon"
        >
          <div
            className="absolute inset-0 opacity-15 rounded-lg"
            style={{ backgroundColor: accentColor }}
          />
          <div style={{ color: accentColor }}>
            {isUp ? <TrendingUpIcon /> : <TrendingDownIcon />}
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-text-primary">
            {insight.headline}
          </p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Next-tier — progress bar with tier labels */
function NextTierCard({ insight, animationDelay = 0 }: InsightCardProps) {
  const tierInfo = parseNextTier(insight.headline);

  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 text-amber">
          <ArrowUpIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-text-primary">
            {insight.headline}
          </p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {insight.body}
          </p>

          {/* Tier progress visualization */}
          {tierInfo && (
            <div
              className="flex items-center gap-1.5 mt-3"
              aria-hidden="true"
            >
              {TIER_LIST.map((tier, i) => (
                <div
                  key={tier}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className={`h-1.5 w-full rounded-full ${
                      i <= tierInfo.currentIndex
                        ? "bg-amber"
                        : i === tierInfo.nextIndex
                          ? "bg-amber/20"
                          : "bg-track"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-heading leading-none ${
                      i === tierInfo.currentIndex
                        ? "text-amber font-semibold"
                        : i === tierInfo.nextIndex
                          ? "text-text-secondary"
                          : "text-text-secondary/40"
                    }`}
                  >
                    {tier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Coaching tip — compact card with dimension-colored icon */
function CoachingTipCard({ insight, animationDelay = 0 }: InsightCardProps) {
  const dimColor = insight.dimension
    ? `var(--color-dimension-${insight.dimension})`
    : "var(--color-amber)";

  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className="rounded-lg border border-stroke/50 bg-card/50 px-4 py-3 animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5" style={{ color: dimColor }}>
          <LightbulbIcon />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-medium text-text-primary">
            {insight.headline}
          </p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Archetype — identity card with colored icon and headline */
function ArchetypeCard({ insight, animationDelay = 0 }: InsightCardProps) {
  const archetypeColor = resolveArchetypeColor(insight.headline);

  return (
    <div
      role="article"
      aria-label={`${insight.headline} ${insight.body}`}
      className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up overflow-hidden"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
          data-testid="archetype-icon"
        >
          <div
            className="absolute inset-0 opacity-15 rounded-lg"
            style={{ backgroundColor: archetypeColor }}
          />
          <div style={{ color: archetypeColor }}>
            <TargetIcon size={18} />
          </div>
        </div>
        <div className="min-w-0">
          <p
            className="font-heading text-sm font-bold"
            style={{ color: archetypeColor }}
          >
            {insight.headline}
          </p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component — delegates to type-specific renderer
// ---------------------------------------------------------------------------

export function InsightCard({
  insight,
  animationDelay = 0,
}: InsightCardProps) {
  switch (insight.type) {
    case "achievement":
      return (
        <AchievementCard insight={insight} animationDelay={animationDelay} />
      );
    case "trend":
      return <TrendCard insight={insight} animationDelay={animationDelay} />;
    case "next-tier":
      return <NextTierCard insight={insight} animationDelay={animationDelay} />;
    case "tip":
      if (insight.id === "tip-archetype") {
        return (
          <ArchetypeCard insight={insight} animationDelay={animationDelay} />
        );
      }
      return (
        <CoachingTipCard insight={insight} animationDelay={animationDelay} />
      );
  }
}
