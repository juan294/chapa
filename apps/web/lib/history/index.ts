// ---------------------------------------------------------------------------
// History module — barrel export
// ---------------------------------------------------------------------------

// Types
export type { MetricsSnapshot, SnapshotPenalty } from "./types";
export type { SnapshotDiff, CategoricalChange, PenaltyChanges } from "./diff";
export type { TrendSummary, DimensionTrend, DateValue } from "./trend";

// Snapshot construction
export { buildSnapshot } from "./snapshot";

// Redis operations
export { recordSnapshot, getSnapshots, getLatestSnapshot, getSnapshotCount } from "./history";

// Analysis
export { compareSnapshots, explainDiff } from "./diff";
export { computeTrend } from "./trend";
