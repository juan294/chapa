import { createScoringWindow, type CoreCountInputs, type StatsData, type HeatmapDay } from "@chapa/shared";
import { toDateString } from "@/lib/utils/date";
import { calculateObservedCoreV7 } from "@/lib/impact/observed-v7";
import { calculateReportCraftInputs } from "@/lib/insights/report-craft";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

/**
 * #1335 phase 5 — v6 is retired. Each archetype guide page (`/archetypes/*`)
 * still needs a sample whose dimension shape visibly reads as that archetype,
 * so these build real v7.2 `ScoreViewModel`s from tuned evidence counts
 * through the production `calculateObservedCoreV7` arithmetic (same
 * approach as `lib/render/observed-demo-data.ts`), rather than hand-picking
 * a display score the way the old `ImpactV6Result` constants did.
 *
 * `coreArchetypeV7` (lib/impact/v7.ts) derives the archetype purely from the
 * four core dimensions and never returns "Artificer" — that persona is
 * conveyed instead by the separate report-Craft channel: the Artificer
 * sample below shares Balanced-shaped core dimensions but adds a
 * near-maximal scored Craft report, so its badge draws the fifth (Craft)
 * spoke the other six archetypes leave unscored.
 */
const ARCHETYPE_WINDOW = createScoringWindow("2026-09-08T10:00:00.000Z");

function archetypeCounts(delivery: number, quality: number, weeks: number, projects: number, categories: number): CoreCountInputs {
  const point = (value: number) => ({ lower: value, upper: value });
  return {
    deliveryUnits: point(delivery),
    quality: {
      rationale: point(quality),
      verification: point(quality),
      review_or_correction: point(quality),
      outcome_followup: point(quality),
    },
    activeIsoWeeks: point(weeks),
    eligibleProjects: point(projects),
    eligibleCategories: point(categories),
  };
}

/** Core-only sample: no report has been imported, so Craft renders as the
 * labelled not-observed state rather than a fake numeric vertex. */
function archetypeScoring(handle: string, delivery: number, quality: number, weeks: number, projects: number, categories: number): ScoreViewModel {
  const calculation = calculateObservedCoreV7({ policyVersion: "v7.2", window: ARCHETYPE_WINDOW, counts: archetypeCounts(delivery, quality, weeks, projects, categories) });
  const value = (source: { exact: number; displayValue: number }) => ({ kind: "point" as const, value: source.exact, display: source.displayValue });
  return {
    illustrative: true, observedInputs: calculation.inputs, policyVersion: "v7.2", handle, identity: null, window: null,
    dimensions: {
      delivery: value(calculation.core.dimensions.delivery),
      quality: value(calculation.core.dimensions.quality),
      consistency: value(calculation.core.dimensions.consistency),
      breadth: value(calculation.core.dimensions.breadth),
    },
    composite: value(calculation.core.composite), tier: calculation.core.tier, archetype: calculation.core.archetype,
    craft: null, reportCraft: { status: "no_report", unlocked: false, report: null },
    coverage: [], exclusions: [], limitations: [],
  };
}

/** Adds a scored report-Craft channel on top of a core sample — used only by
 * the Artificer persona, whose defining trait is Craft mastery rather than a
 * dominant core dimension. */
function withReportCraft(base: ScoreViewModel, total: number, fully: number, mostly: number, failed: number): ScoreViewModel {
  const craft = calculateReportCraftInputs({
    policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window: ARCHETYPE_WINDOW,
    reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" },
    totalSessions: total, outcomes: { fully_achieved: fully, mostly_achieved: mostly, partially_achieved: 0, not_achieved: failed },
    unknownSessions: 0, unclassifiedSessions: 0,
  });
  if (craft.status !== "valid" || craft.result.status !== "scored") throw new Error("Invalid illustrative archetype report");
  return {
    ...base,
    reportCraft: {
      status: "scored", unlocked: true,
      report: { reportRef: "00000000-0000-4000-8000-00000000000a", supersedesReportRef: null, inputs: craft.inputs, result: craft.result },
    },
  };
}

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
        date: toDateString(d),
        count: LEVEL_TO_COUNT[grid[week]![day]!] ?? 0,
      });
    }
  }
  return days;
}

/* ── Builder: intense bursts of shipping, heavy weekday activity ───── */
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

/* Builder: dominant delivery, evidence counts near the delivery cap. */
export const BUILDER_SCORING = archetypeScoring("builder", 120, 1, 3, 1, 1);

/* ── Quality Champion: steady review activity, fewer personal commits ── */
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

/* Guardian: dominant quality practices, evidence counts near the quality cap. */
export const GUARDIAN_SCORING = archetypeScoring("guardian", 2, 12, 3, 1, 1);

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

/* Marathoner: dominant consistency, active-week count near the consistency cap. */
export const MARATHONER_SCORING = archetypeScoring("marathoner", 2, 1, 40, 1, 1);

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

/* Polymath: dominant breadth, project and category counts at their caps. */
export const POLYMATH_SCORING = archetypeScoring("polymath", 2, 1, 3, 4, 4);

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

/* Balanced: all four dimensions close together, none near its cap. */
export const BALANCED_SCORING = archetypeScoring("balanced", 30, 6, 16, 2, 2);

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

/* Emerging: every count is low, so mean and max both stay below the archetype floor. */
export const EMERGING_SCORING = archetypeScoring("emerging", 1, 0, 1, 0, 0);

/* ── Artificer: craft (AI tool mastery) is the dominant dimension ───── */
const ARTIFICER_GRID: number[][] = [
  [0, 2, 3, 3, 2, 1, 0],
  [1, 3, 3, 2, 3, 0, 0],
  [0, 2, 3, 3, 2, 1, 0],
  [1, 3, 2, 3, 3, 0, 0],
  [0, 2, 3, 2, 3, 1, 0],
  [1, 3, 3, 3, 2, 0, 0],
  [0, 2, 3, 3, 3, 1, 0],
  [1, 3, 2, 3, 2, 0, 0],
  [0, 2, 3, 3, 3, 1, 0],
  [1, 3, 3, 2, 3, 0, 0],
  [0, 2, 3, 3, 2, 1, 0],
  [1, 3, 2, 3, 3, 0, 0],
  [0, 2, 3, 3, 2, 1, 0],
];

export const ARTIFICER_STATS: StatsData = {
  handle: "artificer",
  displayName: "Dana Vasquez",
  commitsTotal: 480,
  activeDays: 200,
  prsMergedCount: 95,
  prsMergedWeight: 88,
  reviewsSubmittedCount: 40,
  issuesClosedCount: 45,
  linesAdded: 52000,
  linesDeleted: 24000,
  reposContributed: 5,
  topRepoShare: 0.45,
  maxCommitsIn10Min: 2,
  totalStars: 620,
  totalForks: 140,
  totalWatchers: 55,
  heatmapData: buildHeatmap(ARTIFICER_GRID),
  fetchedAt: "2025-01-01T00:00:00Z",
};

/* Artificer: Balanced-shaped core plus a near-maximal scored Craft report —
 * `coreArchetypeV7` never returns "Artificer" itself (see module doc above). */
export const ARTIFICER_SCORING = withReportCraft(archetypeScoring("artificer", 30, 6, 16, 2, 2), 50, 48, 2, 0);
