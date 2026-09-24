import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { makeScoring } from "@/lib/test-helpers/fixtures";

/**
 * A synthetic v7.2 `ScoreViewModel` for badge-rendering unit tests (#1335
 * phase 5 — "delete v6"). `renderBadgeSvg` no longer accepts a legacy
 * `ImpactV6Result`; every render call needs a `scoring` model instead.
 * Composite/tier/archetype match the historical Studio `DEMO_IMPACT` values
 * documented in CLAUDE.md (82 / High / Balanced) so existing assertions on
 * the rendered score glyph keep holding.
 *
 * Built on `makeScoring` (`@/lib/test-helpers/fixtures`), which already
 * produces this exact `reportCraft.report` shape via its `craftDisplay`
 * param — this fixture only supplies the identity/window/dimension values
 * that differ from that factory's own defaults, plus `illustrative:
 * undefined` to cancel the factory's synthetic-baseline default (this
 * model represents an issued receipt, not a simulated one).
 */
export const DEMO_SCORING: ScoreViewModel = makeScoring({
  illustrative: undefined,
  handle: "developer",
  identity: {
    receiptId: "00000000-0000-4000-8000-000000000001",
    revisionId: "00000000-0000-4000-8000-000000000002",
    revision: 1,
    recordedAt: "2026-09-01T00:00:00.000Z",
    action: "create",
    supersedesRevisionId: null,
    contentHash: "a".repeat(64),
  },
  // `startInclusive`/`endExclusive` are full RFC3339 instants, matching
  // `createScoringWindow`'s own output exactly (`packages/shared/src/
  // scoring-window.ts`) — `readPublicComparison` re-derives the window from
  // `referenceTime` and rejects any field that doesn't byte-match.
  window: {
    referenceTime: "2026-09-01T00:00:00.000Z",
    referenceDate: "2026-09-01",
    startInclusive: "2025-09-02T00:00:00.000Z",
    endExclusive: "2026-09-02T00:00:00.000Z",
    calendarDays: 365,
  },
  dimensions: { delivery: 88, quality: 72, consistency: 80, breadth: 65 },
  composite: 82,
  tier: "High",
  archetype: "Builder",
  craftDisplay: 72,
});

/** All-zero dimensions, no Craft report at all — every radar axis reads
 * `allZero`, exercising the "no data" empty-radar marker. */
export const DEMO_SCORING_ZERO: ScoreViewModel = {
  ...DEMO_SCORING,
  dimensions: {
    delivery: { kind: "point", value: 0, display: 0 },
    quality: { kind: "point", value: 0, display: 0 },
    consistency: { kind: "point", value: 0, display: 0 },
    breadth: { kind: "point", value: 0, display: 0 },
  },
  composite: { kind: "point", value: 0, display: 0 },
  reportCraft: { status: "no_report", unlocked: false, report: null },
};
