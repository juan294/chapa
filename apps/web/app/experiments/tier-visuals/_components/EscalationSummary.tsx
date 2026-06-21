import { type TierName } from "./tier-data";

/* ── Visual escalation summary ────────────────────────────── */

const ESCALATION_ROWS: {
  tier: TierName;
  features: string[];
}[] = [
  {
    tier: "Emerging",
    features: [
      "Gray muted tones",
      "Static border",
      "No animations",
      "Simple fade-in",
    ],
  },
  {
    tier: "Solid",
    features: [
      "White/silver accents",
      "Subtle text shadow",
      "Clean static border",
      "Professional presence",
    ],
  },
  {
    tier: "High",
    features: [
      "Gold gradient score text",
      "Amber glow border",
      "Warm ambient light",
      "Premium warmth",
    ],
  },
  {
    tier: "Elite",
    features: [
      "Animated gold shimmer on score",
      "Rotating gradient border",
      "Sparkle accents",
      "Outer glow aura",
    ],
  },
];

export function EscalationSummary() {
  return (
    <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mb-2">
          Visual Escalation
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Each tier adds progressive visual treatment. Higher tiers feel
          noticeably more premium and aspirational.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ESCALATION_ROWS.map((row, i) => {
          const isAmber = row.tier === "High" || row.tier === "Elite";
          const tierColor = row.tier === "Emerging"
            ? "text-text-secondary"
            : row.tier === "Solid"
              ? "text-text-primary"
              : "text-amber";
          const borderColor = row.tier === "Emerging"
            ? "border-[rgba(154,164,178,0.15)]"
            : row.tier === "Solid"
              ? "border-[rgba(230,237,243,0.12)]"
              : "border-amber/20";
          const bgColor = row.tier === "Elite"
            ? "bg-amber/[0.04]"
            : row.tier === "High"
              ? "bg-amber/[0.02]"
              : "bg-warm-card/30";

          return (
            <div
              key={row.tier}
              className={`rounded-xl border ${borderColor} ${bgColor} p-5`}
            >
              {/* Arrow connector */}
              {i > 0 && (
                <div className="hidden lg:block absolute -left-3 top-1/2 -translate-y-1/2 text-text-secondary/30" aria-hidden="true">
                </div>
              )}
              <p className={`${tierColor} font-bold font-heading text-base mb-1`}>
                {row.tier}
              </p>
              <p className="text-text-secondary text-[10px] mb-3">
                {row.tier === "Emerging"
                  ? "Score < 50"
                  : row.tier === "Solid"
                    ? "Score 50-74"
                    : row.tier === "High"
                      ? "Score 75-89"
                      : "Score 90+"}
              </p>
              <ul className="space-y-1.5">
                {row.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span
                      className={`mt-1.5 block w-1 h-1 rounded-full shrink-0 ${
                        isAmber ? "bg-amber/60" : "bg-text-secondary/40"
                      }`}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Arrow progression */}
      <div className="mt-6 flex items-center justify-center gap-2 text-text-secondary/40">
        <span className="text-text-secondary text-xs">Understated</span>
        <svg width="120" height="12" viewBox="0 0 120 12" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="arrow-grad" x1="0" y1="6" x2="120" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9AA4B2" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <line x1="0" y1="6" x2="112" y2="6" stroke="url(#arrow-grad)" strokeWidth="1.5" />
          <polygon points="112,2 120,6 112,10" fill="var(--color-amber)" fillOpacity="0.8" />
        </svg>
        <span className="text-amber text-xs font-semibold">Aspirational</span>
      </div>
    </section>
  );
}
