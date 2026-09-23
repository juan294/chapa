import { SCORING_OBSERVED_POLICY } from "@chapa/shared";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

/**
 * A synthetic v7.2 `ScoreViewModel` for badge-rendering unit tests (#1335
 * phase 5 — "delete v6"). `renderBadgeSvg` no longer accepts a legacy
 * `ImpactV6Result`; every render call needs a `scoring` model instead.
 * Composite/tier/archetype match the historical Studio `DEMO_IMPACT` values
 * documented in CLAUDE.md (82 / High / Balanced) so existing assertions on
 * the rendered score glyph keep holding.
 */
const REPORT_REF = "00000000-0000-4000-8000-000000000003";
const REPORT_PERIOD = { startInclusive: "2026-08-01T00:00:00.000Z", endExclusive: "2026-09-01T00:00:00.000Z" };

/** Matches the historical `DEMO_IMPACT` (`demoData.ts`) dimension/tier/
 * archetype/composite values exactly, including its Craft axis (72), so a
 * pre-#1335 byte-baseline test's rendered geometry stays comparable — only
 * the receipt-vs-legacy-aggregate model shape differs. */
export const DEMO_SCORING: ScoreViewModel = {
  policyVersion: "v7.2",
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
  window: {
    referenceTime: "2026-09-01T00:00:00.000Z",
    referenceDate: "2026-09-01",
    startInclusive: "2025-09-02",
    endExclusive: "2026-09-02",
    calendarDays: 365,
  },
  dimensions: {
    delivery: { kind: "point", value: 88, display: 88 },
    quality: { kind: "point", value: 72, display: 72 },
    consistency: { kind: "point", value: 80, display: 80 },
    breadth: { kind: "point", value: 65, display: 65 },
  },
  composite: { kind: "point", value: 82, display: 82 },
  tier: "High",
  archetype: "Builder",
  craft: null,
  reportCraft: {
    status: "scored",
    unlocked: true,
    report: {
      reportRef: REPORT_REF,
      supersedesReportRef: null,
      inputs: {
        policyVersion: "v7.2",
        classifierRevision: "cc-outcomes-v7.2",
        window: { referenceTime: "2026-09-01T00:00:00.000Z", referenceDate: "2026-09-01", startInclusive: "2025-09-02", endExclusive: "2026-09-02", calendarDays: 365 },
        reportPeriod: REPORT_PERIOD,
        totalSessions: 20,
        outcomes: { fully_achieved: 14, mostly_achieved: 4, partially_achieved: 1, not_achieved: 1 },
        unknownSessions: 0,
        unclassifiedSessions: 0,
      },
      result: {
        status: "scored",
        unlocked: true,
        provenance: "report_derived",
        assessment: "model_estimate",
        reportPeriod: REPORT_PERIOD,
        point: { kind: "point", exact: 72, displayValue: 72, displayLabel: "72" },
        trace: {
          outcomeCredits: SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits,
          creditedSessions: 18, recognizedSessions: 19, totalSessions: 20,
          unknownSessions: 0, unclassifiedSessions: 0, recognizedCoverage: 0.95, exact: 72,
        },
      },
    },
  },
  freshness: "current",
  coverage: [],
  exclusions: [],
  limitations: [],
};

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
