import type { StatsData, ImpactV4Result, HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Deterministic heatmap (91 days = 13 weeks × 7 days)
// ---------------------------------------------------------------------------

function generateMockHeatmap(): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const start = new Date("2024-01-01");
  for (let i = 0; i < 91; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const seed = (Math.floor(i / 7) * 17 + (i % 7) * 31 + 7) % 100;
    let count = 0;
    if (seed >= 20 && seed < 45) count = 2;
    else if (seed >= 45 && seed < 70) count = 5;
    else if (seed >= 70 && seed < 88) count = 9;
    else if (seed >= 88) count = 14;
    days.push({ date: d.toISOString().slice(0, 10), count });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Shared mock stats
// ---------------------------------------------------------------------------

export const MOCK_STATS: StatsData = {
  handle: "juan294",
  displayName: "Juan García",
  avatarUrl: "",
  commitsTotal: 423,
  activeDays: 218,
  prsMergedCount: 67,
  prsMergedWeight: 89,
  reviewsSubmittedCount: 45,
  issuesClosedCount: 23,
  linesAdded: 34_200,
  linesDeleted: 12_800,
  reposContributed: 8,
  topRepoShare: 0.35,
  maxCommitsIn10Min: 3,
  totalStars: 1200,
  totalForks: 89,
  totalWatchers: 34,
  heatmapData: generateMockHeatmap(),
  fetchedAt: "2024-12-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Shared mock impact
// ---------------------------------------------------------------------------

export const MOCK_IMPACT: ImpactV4Result = {
  handle: "juan294",
  profileType: "collaborative",
  dimensions: {
    building: 85,
    guarding: 72,
    consistency: 91,
    breadth: 68,
  },
  archetype: "Builder",
  compositeScore: 79,
  confidence: 92,
  confidencePenalties: [],
  adjustedComposite: 87,
  tier: "Elite",
  computedAt: "2024-12-01T00:00:00Z",
};
