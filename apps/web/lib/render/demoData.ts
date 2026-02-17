import type { StatsData, ImpactV4Result, HeatmapDay } from "@chapa/shared";

/* ── Heatmap data (13 weeks × 7 days = 91 entries) ────────────────────────
   Levels: 0 = none, 1 = low, 2 = medium, 3 = high, 4 = intense
   Converted to counts that map back to the same heatmap color levels
   via getHeatmapColor: 0→0, 1→1, 2→4, 3→8, 4→12                        */
const LEVEL_GRID: number[][] = [
  [0, 2, 3, 2, 1, 0, 0],
  [1, 3, 4, 3, 2, 1, 0],
  [2, 4, 3, 4, 3, 0, 0],
  [1, 2, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 2, 0, 0],
  [3, 4, 4, 3, 4, 1, 0],
  [2, 3, 2, 4, 3, 0, 1],
  [1, 2, 3, 2, 1, 0, 0],
  [0, 3, 4, 4, 3, 1, 0],
  [2, 4, 3, 2, 4, 0, 0],
  [1, 3, 4, 3, 2, 1, 0],
  [3, 4, 2, 4, 3, 0, 1],
  [2, 3, 4, 3, 2, 1, 0],
];

const LEVEL_TO_COUNT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 4,
  3: 8,
  4: 12,
};

function buildDemoHeatmap(): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  // Start 90 days before a fixed reference date so dates are stable
  const baseDate = new Date("2025-01-01");
  for (let week = 0; week < LEVEL_GRID.length; week++) {
    for (let day = 0; day < LEVEL_GRID[week]!.length; day++) {
      const idx = week * 7 + day;
      const d = new Date(baseDate);
      d.setDate(d.getDate() + idx);
      days.push({
        date: d.toISOString().slice(0, 10),
        count: LEVEL_TO_COUNT[LEVEL_GRID[week]![day]!] ?? 0,
      });
    }
  }
  return days;
}

export const DEMO_STATS: StatsData = {
  handle: "developer",
  displayName: "Bertram Gilfoyle",
  commitsTotal: 420,
  activeDays: 195,
  prsMergedCount: 87,
  prsMergedWeight: 95,
  reviewsSubmittedCount: 64,
  issuesClosedCount: 32,
  linesAdded: 48200,
  linesDeleted: 21400,
  reposContributed: 9,
  topRepoShare: 0.35,
  maxCommitsIn10Min: 3,
  totalStars: 1200,
  totalForks: 40,
  totalWatchers: 89,
  heatmapData: buildDemoHeatmap(),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const DEMO_IMPACT: ImpactV4Result = {
  handle: "developer",
  profileType: "collaborative",
  dimensions: {
    building: 88,
    guarding: 72,
    consistency: 80,
    breadth: 65,
  },
  archetype: "Builder",
  compositeScore: 76,
  confidence: 87,
  confidencePenalties: [],
  adjustedComposite: 82,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};
