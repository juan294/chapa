import type { StatsData, ImpactV4Result, HeatmapDay } from "@chapa/shared";

const LEVEL_TO_COUNT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 4,
  3: 8,
  4: 12,
};

function buildHeatmap(grid: number[][]): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const baseDate = new Date("2025-01-01");
  for (let week = 0; week < grid.length; week++) {
    for (let day = 0; day < grid[week]!.length; day++) {
      const idx = week * 7 + day;
      const d = new Date(baseDate);
      d.setDate(d.getDate() + idx);
      days.push({
        date: d.toISOString().slice(0, 10),
        count: LEVEL_TO_COUNT[grid[week]![day]!] ?? 0,
      });
    }
  }
  return days;
}

/* ── Builder: intense bursts of shipping, heavy weekday activity ─────── */
const BUILDER_GRID: number[][] = [
  [0, 3, 4, 4, 3, 1, 0],
  [0, 4, 4, 3, 4, 0, 0],
  [1, 3, 4, 4, 4, 2, 0],
  [0, 4, 3, 4, 3, 0, 0],
  [0, 2, 4, 4, 4, 1, 0],
  [1, 4, 4, 3, 4, 0, 0],
  [0, 3, 4, 4, 3, 2, 0],
  [0, 4, 3, 4, 4, 0, 0],
  [1, 4, 4, 4, 3, 1, 0],
  [0, 3, 4, 3, 4, 0, 0],
  [0, 4, 4, 4, 4, 2, 0],
  [1, 3, 3, 4, 3, 0, 0],
  [0, 4, 4, 3, 4, 1, 0],
];

export const BUILDER_STATS: StatsData = {
  handle: "builder",
  displayName: "Alex Rivera",
  commitsTotal: 580,
  activeDays: 210,
  prsMergedCount: 124,
  prsMergedWeight: 98,
  reviewsSubmittedCount: 28,
  issuesClosedCount: 67,
  linesAdded: 62400,
  linesDeleted: 28100,
  reposContributed: 4,
  topRepoShare: 0.65,
  maxCommitsIn10Min: 2,
  totalStars: 340,
  totalForks: 85,
  totalWatchers: 32,
  heatmapData: buildHeatmap(BUILDER_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const BUILDER_IMPACT: ImpactV4Result = {
  handle: "builder",
  profileType: "collaborative",
  dimensions: {
    building: 92,
    guarding: 34,
    consistency: 68,
    breadth: 38,
  },
  archetype: "Builder",
  compositeScore: 72,
  confidence: 91,
  confidencePenalties: [],
  adjustedComposite: 78,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

/* ── Guardian: steady review activity, fewer personal commits ────────── */
const GUARDIAN_GRID: number[][] = [
  [0, 2, 2, 2, 2, 0, 0],
  [0, 2, 3, 2, 2, 1, 0],
  [1, 2, 2, 3, 2, 0, 0],
  [0, 3, 2, 2, 2, 0, 0],
  [0, 2, 2, 2, 3, 1, 0],
  [1, 2, 3, 2, 2, 0, 0],
  [0, 2, 2, 2, 2, 0, 0],
  [0, 2, 2, 3, 2, 1, 0],
  [1, 3, 2, 2, 2, 0, 0],
  [0, 2, 2, 2, 3, 0, 0],
  [0, 2, 3, 2, 2, 1, 0],
  [1, 2, 2, 3, 2, 0, 0],
  [0, 2, 2, 2, 2, 0, 0],
];

export const GUARDIAN_STATS: StatsData = {
  handle: "guardian",
  displayName: "Morgan Chen",
  commitsTotal: 180,
  activeDays: 165,
  prsMergedCount: 22,
  prsMergedWeight: 40,
  reviewsSubmittedCount: 312,
  issuesClosedCount: 15,
  linesAdded: 12600,
  linesDeleted: 8400,
  reposContributed: 3,
  topRepoShare: 0.72,
  maxCommitsIn10Min: 1,
  totalStars: 180,
  totalForks: 42,
  totalWatchers: 28,
  heatmapData: buildHeatmap(GUARDIAN_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const GUARDIAN_IMPACT: ImpactV4Result = {
  handle: "guardian",
  profileType: "collaborative",
  dimensions: {
    building: 38,
    guarding: 90,
    consistency: 62,
    breadth: 30,
  },
  archetype: "Guardian",
  compositeScore: 68,
  confidence: 88,
  confidencePenalties: [],
  adjustedComposite: 74,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

/* ── Marathoner: remarkably even daily contributions ─────────────────── */
const MARATHONER_GRID: number[][] = [
  [0, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 1, 0],
  [0, 2, 2, 2, 2, 1, 1],
  [1, 2, 2, 2, 2, 1, 0],
  [0, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 1, 1],
  [0, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 1, 0],
  [0, 2, 2, 2, 2, 1, 1],
  [1, 2, 2, 2, 2, 1, 0],
  [0, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 1, 1],
  [0, 2, 2, 2, 2, 1, 0],
];

export const MARATHONER_STATS: StatsData = {
  handle: "marathoner",
  displayName: "Sam Nakamura",
  commitsTotal: 340,
  activeDays: 290,
  prsMergedCount: 48,
  prsMergedWeight: 62,
  reviewsSubmittedCount: 35,
  issuesClosedCount: 24,
  linesAdded: 28400,
  linesDeleted: 14200,
  reposContributed: 3,
  topRepoShare: 0.55,
  maxCommitsIn10Min: 1,
  totalStars: 120,
  totalForks: 30,
  totalWatchers: 18,
  heatmapData: buildHeatmap(MARATHONER_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const MARATHONER_IMPACT: ImpactV4Result = {
  handle: "marathoner",
  profileType: "collaborative",
  dimensions: {
    building: 52,
    guarding: 36,
    consistency: 94,
    breadth: 32,
  },
  archetype: "Marathoner",
  compositeScore: 65,
  confidence: 93,
  confidencePenalties: [],
  adjustedComposite: 72,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

/* ── Polymath: spread across many repos, documentation contributor ───── */
const POLYMATH_GRID: number[][] = [
  [0, 1, 3, 0, 2, 0, 1],
  [2, 0, 1, 3, 0, 2, 0],
  [0, 3, 0, 2, 1, 0, 2],
  [1, 0, 2, 0, 3, 1, 0],
  [0, 2, 0, 3, 0, 0, 1],
  [3, 0, 1, 0, 2, 2, 0],
  [0, 1, 0, 2, 0, 1, 3],
  [2, 0, 3, 0, 1, 0, 0],
  [0, 2, 0, 1, 3, 0, 2],
  [1, 0, 2, 3, 0, 1, 0],
  [0, 3, 0, 0, 2, 0, 1],
  [2, 0, 1, 2, 0, 3, 0],
  [0, 1, 3, 0, 2, 0, 1],
];

export const POLYMATH_STATS: StatsData = {
  handle: "polymath",
  displayName: "Jordan Okafor",
  commitsTotal: 310,
  activeDays: 175,
  prsMergedCount: 56,
  prsMergedWeight: 70,
  reviewsSubmittedCount: 42,
  issuesClosedCount: 38,
  linesAdded: 34800,
  linesDeleted: 18600,
  reposContributed: 14,
  topRepoShare: 0.12,
  maxCommitsIn10Min: 2,
  totalStars: 1800,
  totalForks: 420,
  totalWatchers: 95,
  heatmapData: buildHeatmap(POLYMATH_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const POLYMATH_IMPACT: ImpactV4Result = {
  handle: "polymath",
  profileType: "collaborative",
  dimensions: {
    building: 48,
    guarding: 40,
    consistency: 50,
    breadth: 88,
  },
  archetype: "Polymath",
  compositeScore: 70,
  confidence: 86,
  confidencePenalties: [],
  adjustedComposite: 76,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

/* ── Balanced: all dimensions within 15pts, avg ≥ 60 ─────────────────── */
const BALANCED_GRID: number[][] = [
  [0, 2, 2, 3, 2, 1, 0],
  [1, 3, 2, 2, 3, 0, 0],
  [0, 2, 3, 2, 2, 1, 1],
  [1, 2, 2, 3, 2, 0, 0],
  [0, 3, 2, 2, 3, 1, 0],
  [1, 2, 3, 2, 2, 0, 1],
  [0, 2, 2, 3, 2, 1, 0],
  [1, 3, 2, 2, 2, 0, 0],
  [0, 2, 3, 2, 3, 1, 1],
  [1, 2, 2, 3, 2, 0, 0],
  [0, 3, 2, 2, 2, 1, 0],
  [1, 2, 2, 3, 3, 0, 1],
  [0, 2, 3, 2, 2, 1, 0],
];

export const BALANCED_STATS: StatsData = {
  handle: "balanced",
  displayName: "Taylor Kim",
  commitsTotal: 360,
  activeDays: 210,
  prsMergedCount: 62,
  prsMergedWeight: 75,
  reviewsSubmittedCount: 58,
  issuesClosedCount: 30,
  linesAdded: 32600,
  linesDeleted: 16800,
  reposContributed: 7,
  topRepoShare: 0.28,
  maxCommitsIn10Min: 2,
  totalStars: 480,
  totalForks: 120,
  totalWatchers: 45,
  heatmapData: buildHeatmap(BALANCED_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const BALANCED_IMPACT: ImpactV4Result = {
  handle: "balanced",
  profileType: "collaborative",
  dimensions: {
    building: 72,
    guarding: 68,
    consistency: 74,
    breadth: 66,
  },
  archetype: "Balanced",
  compositeScore: 70,
  confidence: 90,
  confidencePenalties: [],
  adjustedComposite: 76,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

/* ── Emerging: early-stage, low activity across all dimensions ───────── */
const EMERGING_GRID: number[][] = [
  [0, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 1, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

export const EMERGING_STATS: StatsData = {
  handle: "emerging",
  displayName: "Casey Morales",
  commitsTotal: 45,
  activeDays: 28,
  prsMergedCount: 6,
  prsMergedWeight: 12,
  reviewsSubmittedCount: 3,
  issuesClosedCount: 4,
  linesAdded: 3200,
  linesDeleted: 800,
  reposContributed: 2,
  topRepoShare: 0.85,
  maxCommitsIn10Min: 1,
  totalStars: 8,
  totalForks: 2,
  totalWatchers: 1,
  heatmapData: buildHeatmap(EMERGING_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

export const EMERGING_IMPACT: ImpactV4Result = {
  handle: "emerging",
  profileType: "solo",
  dimensions: {
    building: 22,
    guarding: 8,
    consistency: 18,
    breadth: 15,
  },
  archetype: "Emerging",
  compositeScore: 16,
  confidence: 55,
  confidencePenalties: [],
  adjustedComposite: 14,
  tier: "Emerging",
  computedAt: "2025-01-01T00:00:00Z",
};
