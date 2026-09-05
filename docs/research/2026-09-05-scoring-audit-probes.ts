/** Read-only arithmetic probes. Run from repo root:
 * pnpm exec tsx --tsconfig apps/web/tsconfig.json docs/research/2026-09-05-scoring-audit-probes.ts
 * These demonstrate current behavior; they are not assertions of desired behavior.
 */
import { computeImpactV6, computeBreadth } from '../../apps/web/lib/impact/v6';
import { normalize } from '../../apps/web/lib/impact/utils';
import { applyEMA } from '../../apps/web/lib/impact/smoothing';
import { computeHeatmapEvenness, computeWeekCoverage } from '../../apps/web/lib/impact/heatmap-evenness';
import { computePrWeight } from '../../packages/shared/src/scoring';
import { makeFullStats } from '../../apps/web/lib/test-helpers/fixtures';
import { mergeStats } from '../../apps/web/lib/github/merge';
import { computeCraftScore, _normalizedEntropy, _scoreResponseTime } from '../../apps/web/lib/insights/scoring';
import { isValidInsightsUpload } from '../../apps/web/lib/insights/validation';
import type { InsightsUpload } from '../../packages/shared/src/types';

const heatmap = Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 8, 6 + i)).toISOString().slice(0, 10),
  count: 1,
}));
const base = makeFullStats({
  prsMergedCount: 20, prsMergedWeight: 40, commitsTotal: 300,
  issuesClosedCount: 40, activeDays: 365, reposContributed: 12,
  topRepoShare: 1 / 12, totalStars: 150, totalForks: 80,
  prDescriptionRate: 0, featureBranchRate: 0, issueLinkageRate: 0,
  batchSizeScore: 0, medianPrLeadTimeHours: 48,
  heatmapData: heatmap, linesAdded: 4000, linesDeleted: 0,
  microCommitRatio: 0, docsOnlyPrRatio: 0,
});
const summarize = (reviews: number, craft?: number) => {
  const r = computeImpactV6({ ...base, reviewsSubmittedCount: reviews }, craft);
  // Composite is independent of the wall clock; headline recency is not.
  return { reviews, craft, type: r.profileType, dimensions: r.dimensions, composite: r.compositeScore };
};
console.log('review threshold', [summarize(2), summarize(3)]);
console.log('optional Craft', [summarize(2), summarize(2, 40)]);
console.log('normalization examples', { commits150of300: normalize(150, 300), pr25of60: normalize(25, 60), issues10of40: normalize(10, 40) });
console.log('Breadth theoretical input maximum', computeBreadth({ ...base, topRepoShare: 0, docsOnlyPrRatio: 1 }));
let previous = 60;
const ema = Array.from({ length: 30 }, () => (previous = applyEMA(70, previous)));
console.log('EMA constant raw=70 previous=60, 30 observations', ema);
const sparse = heatmap.filter((_, i) => i % 14 === 0).map(d => ({ ...d, count: 1 }));
const activeDates = new Set(sparse.map(d => d.date));
const padded = heatmap.map(d => ({ ...d, count: activeDates.has(d.date) ? 1 : 0 }));
console.log('same events sparse vs zero-padded', [sparse, padded].map(h => ({ evenness: computeHeatmapEvenness(h), coverage: computeWeekCoverage(h) })));
console.log('same changed lines one PR vs ten PRs', {
  one: computePrWeight({ additions: 1000, deletions: 0, changedFiles: 10 }),
  ten: 10 * computePrWeight({ additions: 100, deletions: 0, changedFiles: 1 }),
});
const left = { ...base, prsMergedCount: 3, medianPrLeadTimeHours: 1, batchSizeScore: 1 };
const right = { ...base, prsMergedCount: 3, medianPrLeadTimeHours: 100, batchSizeScore: 0 };
console.log('median of [1,1,1] plus [2,100,100]', {
  reported: mergeStats(left, right).medianPrLeadTimeHours,
  actual: (1 + 2) / 2,
});
const unknown = { ...base, prsMergedCount: 30, batchSizeScore: undefined };
console.log('quality merge depends on placement of unmeasured platform', {
  first: mergeStats(mergeStats(left, unknown), right).batchSizeScore,
  last: mergeStats(mergeStats(left, right), unknown).batchSizeScore,
});
console.log('normalized tool entropy', {
  twoEqual: _normalizedEntropy({ A: 50, B: 50 }),
  plusRareThird: _normalizedEntropy({ A: 50, B: 50, C: 1 }),
});
console.log('missing vs measured 300-second response time', [_scoreResponseTime(0), _scoreResponseTime(300)]);
const report: InsightsUpload = {
  tool: 'claude-code', reportPeriod: { start: '2026-09-01', end: '2026-09-05' },
  volume: { messages: 100, linesAdded: 500, linesDeleted: 50, files: 20, days: 5, msgsPerDay: 20 },
  toolUsage: { Bash: 50, Read: 30 }, sessionTypes: { 'Single Task': 5 },
  outcomes: { fullyAchieved: 10, mostlyAchieved: 3, partiallyAchieved: 1 },
  friction: { buggyCode: 2, wrongApproach: 1, misunderstoodRequest: 0 },
  satisfaction: { dissatisfied: 1, likelySatisfied: 8, satisfied: 5 },
  multiClauding: { overlapEvents: 3, sessionsInvolved: 2, messagePercent: 15 },
  responseTime: { medianSeconds: 45, averageSeconds: 90 },
  toolErrors: { Other: 5 }, totalSessions: 10, totalToolCalls: 80,
};
const overflowReport = { ...report, toolUsage: JSON.parse('{"Bash":1e309,"Read":1}') };
console.log('JSON overflow accepted and scored', { validation: isValidInsightsUpload(overflowReport), result: computeCraftScore(overflowReport).craftScore });
console.log('finite counts overflow accepted and scored', {
  validation: isValidInsightsUpload({ ...report, toolUsage: { Bash: 1e308, Read: 1e308 } }),
  result: computeCraftScore({ ...report, toolUsage: { Bash: 1e308, Read: 1e308 } }).craftScore,
});
