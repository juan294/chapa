# Phase 1: Types + Scoring Engine

> Parent plan: [Insights Integration](../2026-03-07-insights-integration.md)
> Depends on: Nothing
> Batch eligible: Yes (with Phase 2)

## Goal

Define all TypeScript types for the Insights Layer and implement the pure scoring function `computeCraftScore()` with full test coverage.

## Types to Add

### In `packages/shared/src/types.ts`

```typescript
// ---------------------------------------------------------------------------
// AI Tool Insights — Craft Score
// ---------------------------------------------------------------------------

/** Supported AI coding tools */
export type InsightsTool = "claude-code";

/** Structured data extracted from an AI tool usage report */
export interface InsightsUpload {
  tool: InsightsTool;
  reportPeriod: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  volume: {
    messages: number;
    linesAdded: number;
    linesDeleted: number;
    files: number;
    days: number;
    msgsPerDay: number;
  };
  toolUsage: Record<string, number>;
  sessionTypes: Record<string, number>;
  outcomes: {
    fullyAchieved: number;
    mostlyAchieved: number;
    partiallyAchieved: number;
  };
  friction: {
    buggyCode: number;
    wrongApproach: number;
    misunderstoodRequest: number;
  };
  satisfaction: {
    dissatisfied: number;
    likelySatisfied: number;
    satisfied: number;
  };
  multiClauding: {
    overlapEvents: number;
    sessionsInvolved: number;
    messagePercent: number; // 0-100
  };
  responseTime: {
    medianSeconds: number;
    averageSeconds: number;
  };
  toolErrors: Record<string, number>;
  totalSessions: number;
  totalToolCalls: number;
}

/** Three craft sub-dimensions (each 0-100) */
export interface CraftDimensions {
  proficiency: number;
  effectiveness: number;
  sophistication: number;
}

/** Craft score tier */
export type CraftTier = "Novice" | "Practitioner" | "Expert" | "Master";

/** Full craft score result */
export interface CraftResult {
  tool: InsightsTool;
  dimensions: CraftDimensions;
  craftScore: number;       // 0-100, avg of 3 dimensions
  tier: CraftTier;
  reportPeriod: {
    start: string;
    end: string;
  };
  computedAt: string;       // ISO timestamp
}
```

## Scoring Implementation

### File: `apps/web/lib/insights/scoring.ts`

Pure function — no side effects, no imports beyond shared types/constants.

```typescript
export function computeCraftScore(data: InsightsUpload): CraftResult
```

### Sub-dimension formulas

**Proficiency (tool mastery):**
```
toolDiversity = shannonEntropy(toolUsage) / log2(toolCount)  // normalized 0-1
agentRate = normalize(agentCalls / messages, 0.20)           // cap at 20%
advancedFeatures = (
  normalize(multiClauding.messagePercent / 100, 0.40) * 0.5 +
  sessionTypeDiversity * 0.5                                  // entropy of session types
)
engagementDepth = (
  normalize(msgsPerDay, 80) * 0.5 +
  responseTimeScore * 0.5                                     // faster median = higher
)

proficiency = 100 * (0.30 * toolDiversity
                    + 0.25 * agentRate
                    + 0.25 * advancedFeatures
                    + 0.20 * engagementDepth)
```

**Effectiveness (outcome quality):**
```
achievementRate = (full * 1.0 + mostly * 0.7 + partial * 0.3) / totalOutcomes
satisfactionRate = (satisfied + likelySatisfied) / totalSatisfaction
frictionRatio = 1 - normalize(totalFriction / totalSessions, 0.50)
errorRecovery = 1 - normalize(totalErrors / totalToolCalls, 0.15)

effectiveness = 100 * (0.40 * achievementRate
                      + 0.25 * satisfactionRate
                      + 0.20 * frictionRatio
                      + 0.15 * errorRecovery)
```

**Sophistication (workflow complexity):**
```
complexSessionRate = (multiTask + iterativeRefinement) / totalSessions
linesPerSession = normalize((linesAdded + linesDeleted) / totalSessions, 500)
multiClaudingScore = (
  normalize(overlapEvents, 30) * 0.6 +
  normalize(messagePercent / 100, 0.40) * 0.4
)
filesPerSession = normalize(files / totalSessions, 15)

sophistication = 100 * (0.30 * complexSessionRate
                       + 0.25 * linesPerSession
                       + 0.25 * multiClaudingScore
                       + 0.20 * filesPerSession)
```

**Helpers:**
```typescript
// Log-normalize: same pattern as Impact v4 (apps/web/lib/impact/utils.ts)
function normalize(value: number, cap: number): number {
  return Math.min(1, Math.log(1 + value) / Math.log(1 + cap));
}

// Shannon entropy normalized to 0-1
function normalizedEntropy(counts: Record<string, number>): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const probs = Object.values(counts).map(c => c / total).filter(p => p > 0);
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const maxEntropy = Math.log2(probs.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

// Response time scoring: faster median = higher score
function responseTimeScore(medianSeconds: number): number {
  // 30s median → 1.0, 300s median → ~0.3, 600s+ → ~0.15
  return Math.min(1, Math.log(1 + 300 / Math.max(medianSeconds, 1)) / Math.log(1 + 300 / 30));
}

// Craft tier mapping
function getCraftTier(score: number): CraftTier {
  if (score >= 80) return "Master";
  if (score >= 55) return "Expert";
  if (score >= 30) return "Practitioner";
  return "Novice";
}
```

## Test Coverage

### File: `apps/web/lib/insights/scoring.test.ts`

Required test cases:

1. **Baseline scoring** — typical developer data produces reasonable scores (30-70 range)
2. **Power user scoring** — high tool diversity, multi-clauding, high achievement → 80+ craft score
3. **Beginner scoring** — low sessions, single tool, no multi-clauding → < 30 craft score
4. **Zero/empty data** — all zeros should produce 0 craft score, no crashes
5. **Edge cases** — single session, no friction, no errors, no outcomes
6. **Tier mapping** — verify tier boundaries (0-29, 30-54, 55-79, 80-100)
7. **Determinism** — same input always produces same output
8. **Real-world data** — test with data matching the actual insights report structure
9. **Proficiency sub-dimension** — isolate and verify tool diversity scoring, agent rate, etc.
10. **Effectiveness sub-dimension** — isolate and verify achievement rate weighting
11. **Sophistication sub-dimension** — isolate and verify multi-clauding scoring

## Acceptance Criteria

- [x] All types compile with `pnpm run typecheck`
- [x] `computeCraftScore()` is a pure function (no side effects)
- [x] All 11+ test cases pass (37 tests across 7 describe blocks)
- [x] Scoring produces reasonable results for the real insights data from the reference report
- [x] Edge cases (zero data, single session) don't crash
- [x] Tier mapping is correct at all boundaries

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run test -- --run apps/web/lib/insights/scoring.test.ts 2>&1
```
