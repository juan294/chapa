import type {
  InsightsUpload,
  CraftResult,
  CraftTier,
} from "@chapa/shared";
import { normalize } from "@/lib/impact/utils";

/**
 * Shannon entropy of a distribution, normalized to 0–1.
 * 1.0 = perfectly uniform usage, 0.0 = single tool dominates.
 */
function normalizedEntropy(counts: Record<string, number>): number {
  const values = Object.values(counts).filter((c) => c > 0);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0 || values.length <= 1) return 0;
  const probs = values.map((c) => c / total);
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const maxEntropy = Math.log2(values.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Score response time: faster median → higher score.
 * 30s median → ~1.0, 120s → ~0.6, 300s → ~0.3
 */
function scoreResponseTime(medianSeconds: number): number {
  if (medianSeconds <= 0) return 1;
  return Math.min(
    1,
    Math.log(1 + 300 / medianSeconds) / Math.log(1 + 300 / 30),
  );
}

/** Map composite craft score to tier. */
function getCraftTier(score: number): CraftTier {
  if (score >= 80) return "Master";
  if (score >= 55) return "Expert";
  if (score >= 30) return "Practitioner";
  return "Novice";
}

/**
 * Compute the Proficiency sub-dimension (0–100).
 * Measures tool mastery: diversity, agent orchestration, advanced features, engagement.
 */
function computeProficiency(data: InsightsUpload): number {
  // Tool diversity — Shannon entropy of tool usage distribution
  const toolDiversity = normalizedEntropy(data.toolUsage);

  // Agent usage rate — agent calls as fraction of total messages
  const agentCalls = data.toolUsage["Agent"] ?? 0;
  const messages = Math.max(data.volume.messages, 1);
  const agentRate = normalize(agentCalls / messages, 0.2);

  // Advanced feature adoption — multi-clauding + session type diversity
  const multiClaudingAdoption = normalize(
    data.multiClauding.messagePercent / 100,
    0.4,
  );
  const sessionTypeDiversity = normalizedEntropy(data.sessionTypes);
  const advancedFeatures =
    multiClaudingAdoption * 0.5 + sessionTypeDiversity * 0.5;

  // Engagement depth — messages per day + response time
  const msgsPerDayScore = normalize(data.volume.msgsPerDay, 80);
  const responseTime = scoreResponseTime(data.responseTime.medianSeconds);
  const engagementDepth = msgsPerDayScore * 0.5 + responseTime * 0.5;

  return (
    100 *
    (0.3 * toolDiversity +
      0.25 * agentRate +
      0.25 * advancedFeatures +
      0.2 * engagementDepth)
  );
}

/**
 * Compute the Effectiveness sub-dimension (0–100).
 * Measures outcome quality: achievement rate and satisfaction.
 *
 * Friction events (buggyCode, wrongApproach, misunderstoodRequest) and tool
 * errors are EXCLUDED from scoring. These reflect the AI tool's mistakes,
 * not the developer's skill. Penalizing developers for Claude's errors is
 * unfair and actively discourages uploading fresh insights — the opposite
 * of the behavior we want to encourage on the platform.
 *
 * The friction and toolErrors fields are still collected in InsightsUpload
 * for display and diagnostics, but they have zero weight in the score.
 */
function computeEffectiveness(data: InsightsUpload): number {
  // Achievement rate — weighted outcomes (55%)
  const { fullyAchieved, mostlyAchieved, partiallyAchieved } = data.outcomes;
  const totalOutcomes = fullyAchieved + mostlyAchieved + partiallyAchieved;
  const achievementRate =
    totalOutcomes > 0
      ? (fullyAchieved * 1.0 + mostlyAchieved * 0.7 + partiallyAchieved * 0.3) /
        totalOutcomes
      : 0;

  // Satisfaction rate (45%)
  const { dissatisfied, likelySatisfied, satisfied } = data.satisfaction;
  const totalSatisfaction = dissatisfied + likelySatisfied + satisfied;
  const satisfactionRate =
    totalSatisfaction > 0
      ? (satisfied + likelySatisfied) / totalSatisfaction
      : 0;

  // NOTE: friction events and tool errors are intentionally excluded.
  // They are the AI tool's mistakes, not the developer's.

  return 100 * (0.55 * achievementRate + 0.45 * satisfactionRate);
}

/**
 * Compute the Sophistication sub-dimension (0–100).
 * Measures workflow complexity: multi-task sessions, output scale, parallelism.
 */
function computeSophistication(data: InsightsUpload): number {
  const sessions = Math.max(data.totalSessions, 1);

  // Complex session rate — multi-task + iterative refinement sessions
  const multiTask = data.sessionTypes["Multi Task"] ?? 0;
  const iterative = data.sessionTypes["Iterative Refinement"] ?? 0;
  const complexSessionRate = Math.min(1, (multiTask + iterative) / sessions);

  // Lines per session
  const linesPerSession =
    (data.volume.linesAdded + data.volume.linesDeleted) / sessions;
  const linesScore = normalize(linesPerSession, 500);

  // Multi-clauding intensity
  const overlapScore = normalize(data.multiClauding.overlapEvents, 30);
  const parallelMsgScore = normalize(
    data.multiClauding.messagePercent / 100,
    0.4,
  );
  const multiClaudingScore = overlapScore * 0.6 + parallelMsgScore * 0.4;

  // Files per session
  const filesPerSession = data.volume.files / sessions;
  const filesScore = normalize(filesPerSession, 15);

  return (
    100 *
    (0.3 * complexSessionRate +
      0.25 * linesScore +
      0.25 * multiClaudingScore +
      0.2 * filesScore)
  );
}

/**
 * Compute the full Craft Score from an insights upload.
 * Pure function — no side effects, deterministic output.
 */
export function computeCraftScore(data: InsightsUpload): CraftResult {
  const proficiency = Math.round(computeProficiency(data));
  const effectiveness = Math.round(computeEffectiveness(data));
  const sophistication = Math.round(computeSophistication(data));
  const craftScore = Math.round(
    (proficiency + effectiveness + sophistication) / 3,
  );

  return {
    tool: data.tool,
    dimensions: { proficiency, effectiveness, sophistication },
    craftScore,
    tier: getCraftTier(craftScore),
    reportPeriod: { ...data.reportPeriod },
    computedAt: new Date().toISOString(),
  };
}

// Export helpers for isolated testing
export {
  normalize as _normalize,
} from "@/lib/impact/utils";
export {
  normalizedEntropy as _normalizedEntropy,
  scoreResponseTime as _scoreResponseTime,
  getCraftTier as _getCraftTier,
  computeProficiency as _computeProficiency,
  computeEffectiveness as _computeEffectiveness,
  computeSophistication as _computeSophistication,
};
