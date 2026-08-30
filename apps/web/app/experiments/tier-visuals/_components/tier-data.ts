import { MOCK_STATS, MOCK_IMPACT } from "../../__fixtures__/mock-data";

/* ── Tier definitions ─────────────────────────────────────── */

export type TierName = "Emerging" | "Solid" | "High" | "Elite";

export interface TierData {
  tier: TierName;
  score: number;
  handle: string;
  stars: string;
  forks: number;
  watchers: number;
  heatmapDensity: number;
}

export const TIERS: TierData[] = [
  {
    tier: "Emerging",
    score: 32,
    handle: "@newdev",
    stars: "12",
    forks: 2,
    watchers: 1,
    heatmapDensity: 0.15,
  },
  {
    tier: "Solid",
    score: 62,
    handle: "@steadycoder",
    stars: "234",
    forks: 18,
    watchers: 8,
    heatmapDensity: 0.4,
  },
  {
    tier: "High",
    score: 81,
    handle: "@probuilder",
    stars: "890",
    forks: 45,
    watchers: 19,
    heatmapDensity: 0.65,
  },
  {
    tier: "Elite",
    score: MOCK_IMPACT.adjustedComposite,
    handle: `@${MOCK_STATS.handle}`,
    stars: `${(MOCK_STATS.totalStars / 1000).toFixed(1)}k`,
    forks: MOCK_STATS.totalForks,
    watchers: MOCK_STATS.totalWatchers,
    heatmapDensity: 0.85,
  },
];

/* ── Heatmap generation ───────────────────────────────────── */

export const HEATMAP_COLS = 13;
export const HEATMAP_ROWS = 7;

export function generateHeatmap(density: number): number[][] {
  return Array.from({ length: HEATMAP_COLS }, (_, w) =>
    Array.from({ length: HEATMAP_ROWS }, (_, d) => {
      const seed = ((w * 7 + d) * 2654435761) >>> 0;
      return (seed % 100) < density * 100
        ? Math.min(4, Math.floor((seed % 20) / Math.max(1, 5 - density * 4)))
        : 0;
    }),
  );
}

export function heatmapColor(level: number, tier: TierName): string {
  if (tier === "Emerging") {
    const colors = [
      "rgba(154,164,178,0.04)",
      "rgba(154,164,178,0.15)",
      "rgba(154,164,178,0.30)",
      "rgba(154,164,178,0.50)",
      "rgba(154,164,178,0.75)",
    ];
    return colors[level] ?? colors[0]!;
  }
  if (tier === "Solid") {
    const colors = [
      "rgba(230,237,243,0.04)",
      "rgba(230,237,243,0.15)",
      "rgba(230,237,243,0.30)",
      "rgba(230,237,243,0.50)",
      "rgba(230,237,243,0.75)",
    ];
    return colors[level] ?? colors[0]!;
  }
  // High and Elite use amber
  const colors = [
    "rgba(27, 208, 147, 0.04)",
    "rgba(27, 208, 147, 0.18)",
    "rgba(27, 208, 147, 0.35)",
    "rgba(27, 208, 147, 0.60)",
    "rgba(27, 208, 147, 0.90)",
  ];
  return colors[level] ?? colors[0]!;
}

/* ── Tier visual config ───────────────────────────────────── */

export function tierPillClasses(tier: TierName): string {
  switch (tier) {
    case "Emerging":
      return "bg-[rgba(154,164,178,0.08)] border-[rgba(154,164,178,0.20)] text-text-secondary";
    case "Solid":
      return "bg-[rgba(230,237,243,0.06)] border-[rgba(230,237,243,0.20)] text-text-primary";
    case "High":
      return "bg-amber/10 border-amber/25 text-amber";
    case "Elite":
      return "tier-elite-pill border-amber/30 text-white font-bold";
  }
}

export function tierLabel(tier: TierName): string {
  switch (tier) {
    case "Emerging":
      return "EMERGING";
    case "Solid":
      return "SOLID";
    case "High":
      return "HIGH";
    case "Elite":
      return "ELITE";
  }
}
